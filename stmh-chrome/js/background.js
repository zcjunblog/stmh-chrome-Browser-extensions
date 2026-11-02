import { addBookmark, normalizeUrl } from "./core.mjs";

// Serialize read-modify-write operations across popup, toolbox and context menus.
let writes = Promise.resolve();
function updateBookmarks(change) {
  const operation = writes.then(async () => {
    const stored = await chrome.storage.local.get("bookmarks");
    const items = change(
      Array.isArray(stored.bookmarks) ? stored.bookmarks : [],
    );
    await chrome.storage.local.set({ bookmarks: items });
    return items;
  });
  writes = operation.catch(() => {});
  return operation;
}

function updateProgress(key, time) {
  if (
    typeof key !== "string" ||
    key.length > 5000 ||
    !Number.isFinite(time) ||
    time < 0
  )
    throw new Error("无效的播放进度。");
  const operation = writes.then(async () => {
    const { progress = {} } = await chrome.storage.local.get("progress");
    const entries = Object.entries(progress).filter(
      ([savedKey]) => savedKey !== key,
    );
    entries.push([key, { time, updated: Date.now() }]);
    entries.sort((a, b) => b[1].updated - a[1].updated);
    await chrome.storage.local.set({
      progress: Object.fromEntries(entries.slice(0, 200)),
    });
    return time;
  });
  writes = operation.catch(() => {});
  return operation;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "stmh-save",
      title: "收藏到视听魔盒",
      contexts: ["page", "link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
    chrome.contextMenus.create({
      id: "stmh-play",
      title: "用视听魔盒打开媒体直链",
      contexts: ["audio", "video", "link"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
    chrome.contextMenus.create({
      id: "stmh-open",
      title: "打开视听魔盒",
      contexts: ["action"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  (async () => {
    if (info.menuItemId === "stmh-save") {
      const url = info.linkUrl || info.pageUrl;
      await updateBookmarks((items) =>
        addBookmark(items, {
          url,
          title: info.linkUrl
            ? new URL(url).hostname
            : tab?.title || new URL(url).hostname,
        }),
      );
      await chrome.tabs.create({
        url: chrome.runtime.getURL("toolbox.html?tool=navigation"),
      });
    } else if (info.menuItemId === "stmh-play") {
      const url = normalizeUrl(info.srcUrl || info.linkUrl || "");
      await chrome.tabs.create({
        url: chrome.runtime.getURL(
          `toolbox.html?tool=video&media=${encodeURIComponent(url)}`,
        ),
      });
    } else if (info.menuItemId === "stmh-open") {
      await chrome.tabs.create({
        url: chrome.runtime.getURL("toolbox.html?tool=music"),
      });
    }
  })().catch(async (error) => {
    await chrome.storage.session.set({ menuError: error.message });
    await chrome.tabs.create({
      url: chrome.runtime.getURL("toolbox.html?tool=navigation"),
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(""))
  )
    return;
  const run = async () => {
    if (message.type === "bookmark:list") {
      await writes;
      return (await chrome.storage.local.get({ bookmarks: [] })).bookmarks;
    }
    if (message.type === "bookmark:add")
      return updateBookmarks((items) => addBookmark(items, message.item || {}));
    if (message.type === "bookmark:remove")
      return updateBookmarks((items) =>
        items.filter((item) => item.id !== message.id),
      );
    if (message.type === "progress:save")
      return updateProgress(message.key, message.time);
    if (message.type === "progress:get") {
      await writes;
      const { progress = {} } = await chrome.storage.local.get("progress");
      return progress[message.key]?.time || 0;
    }
    throw new Error("未知操作。");
  };
  run()
    .then((data) => reply({ ok: true, data }))
    .catch((error) => reply({ ok: false, error: error.message }));
  return true;
});
