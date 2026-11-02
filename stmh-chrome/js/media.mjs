import { fileKey, formatTime, normalizeUrl, resumeTime } from "./core.mjs";
import { saveCanvas } from "./wallpaper.mjs";

export function createMediaPlayer(tell) {
  const $ = (id) => document.getElementById(id);
  let mode = "music",
    touched = false;
  const sessions = Object.fromEntries(
    ["music", "video"].map((name) => [
      name,
      {
        element: $(name === "music" ? "audio" : "video"),
        items: [],
        index: -1,
        sequence: 0,
        lastSave: 0,
      },
    ]),
  );
  const current = () => sessions[mode];
  const settings = { volume: 0.8, speed: 1, repeat: false };
  let preferenceWrites = Promise.resolve();
  function applySettings() {
    for (const session of Object.values(sessions)) {
      session.element.volume = settings.volume;
      session.element.playbackRate = settings.speed;
      session.element.loop = settings.repeat;
    }
    $("volume").value = settings.volume;
    $("speed").value = String(settings.speed);
    $("repeat").setAttribute("aria-pressed", String(settings.repeat));
  }
  chrome.storage.local.get("playerSettings").then(({ playerSettings }) => {
    if (touched || !playerSettings) return;
    if (
      Number.isFinite(playerSettings.volume) &&
      playerSettings.volume >= 0 &&
      playerSettings.volume <= 1
    )
      settings.volume = playerSettings.volume;
    if ([0.5, 0.75, 1, 1.25, 1.5, 2].includes(playerSettings.speed))
      settings.speed = playerSettings.speed;
    settings.repeat = playerSettings.repeat === true;
    applySettings();
  });
  function storeSettings() {
    touched = true;
    applySettings();
    const snapshot = { ...settings };
    preferenceWrites = preferenceWrites
      .catch(() => {})
      .then(() => chrome.storage.local.set({ playerSettings: snapshot }))
      .catch((error) => tell(`设置未保存：${error.message}`));
  }
  applySettings();

  async function saveProgress(session, force = false) {
    const item = session.items[session.index];
    if (!item || !Number.isFinite(session.element.duration)) return;
    if (!force && Date.now() - session.lastSave < 2500) return;
    session.lastSave = Date.now();
    const result = await chrome.runtime.sendMessage({
      type: "progress:save",
      key: item.key,
      time: session.element.ended ? 0 : session.element.currentTime,
    });
    if (!result.ok) tell(`进度未保存：${result.error}`);
  }
  function paint() {
    const session = current(),
      element = session.element,
      item = session.items[session.index];
    $("media-title").textContent =
      item?.name || (mode === "music" ? "还没有添加音乐" : "还没有添加视频");
    $("media-subtitle").textContent = item
      ? `${session.index + 1} / ${session.items.length} · ${item.local ? "本地文件 · 不会上传" : "在线媒体直链"}`
      : "文件只在本机读取，不会上传。";
    $("queue-count").textContent =
      `${session.items.length} ${mode === "music" ? "首" : "个"}`;
    $("play").disabled = !item || !!element.error;
    $("previous").disabled = session.items.length < 2;
    $("next").disabled = session.items.length < 2;
    $("seek").disabled = !Number.isFinite(element.duration) || !!element.error;
    $("capture").disabled = !item || !element.videoWidth;
    $("fullscreen").disabled = !item;
    $("elapsed").textContent = formatTime(element.currentTime);
    $("duration").textContent = formatTime(element.duration);
    $("seek").value =
      Number.isFinite(element.duration) && element.duration
        ? (element.currentTime / element.duration) * 100
        : 0;
    const playing = !!item && !element.paused && !element.ended;
    $("play").textContent = playing ? "Ⅱ" : "▶";
    $("play").setAttribute("aria-label", playing ? "暂停" : "播放");
    $("music-art").classList.toggle("is-playing", mode === "music" && playing);
    for (const [index, button] of [
      ...$("playlist").querySelectorAll("button"),
    ].entries()) {
      button.setAttribute("aria-pressed", String(index === session.index));
    }
  }
  function paintList() {
    const session = current();
    $("playlist").replaceChildren(
      ...session.items.map((item, index) => {
        const li = document.createElement("li"),
          button = document.createElement("button");
        const number = document.createElement("span"),
          name = document.createElement("span");
        number.textContent = String(index + 1).padStart(2, "0");
        number.className = "track-number";
        name.textContent = item.name;
        button.append(number, name);
        button.title = item.name;
        button.addEventListener("click", () => load(session, index, true));
        li.append(button);
        return li;
      }),
    );
    paint();
  }
  async function tryPlay(session) {
    try {
      await session.element.play();
    } catch (error) {
      if (error.name !== "AbortError")
        tell("无法播放此媒体。请检查文件格式或网络地址，也可以手动再按播放。");
    }
  }
  async function load(session, index, autoplay = false) {
    const sequence = ++session.sequence;
    await saveProgress(session, true).catch((error) => tell(error.message));
    if (sequence !== session.sequence) return;
    session.element.pause();
    session.loadController?.abort();
    const controller = new AbortController();
    session.loadController = controller;
    session.index = index;
    const item = session.items[index];
    if (!item) return;
    session.element.addEventListener(
      "loadedmetadata",
      async () => {
        try {
          const result = await chrome.runtime.sendMessage({
            type: "progress:get",
            key: item.key,
          });
          if (sequence !== session.sequence || controller.signal.aborted)
            return;
          const time = resumeTime(
            result.ok ? result.data : 0,
            session.element.duration,
          );
          if (time) session.element.currentTime = time;
          paint();
          if (autoplay) await tryPlay(session);
        } catch (error) {
          tell(error.message);
        }
      },
      { once: true, signal: controller.signal },
    );
    session.element.src = item.url;
    session.element.load();
    tell("");
    paintList();
  }
  async function replaceItems(items) {
    const session = current();
    await saveProgress(session, true).catch((error) => tell(error.message));
    session.sequence++;
    session.loadController?.abort();
    session.element.pause();
    session.element.removeAttribute("src");
    session.element.load();
    for (const item of session.items)
      if (item.local) URL.revokeObjectURL(item.url);
    session.index = -1;
    session.items = items;
    await load(session, 0);
  }
  async function chooseFiles(fileList) {
    const prefix = mode === "music" ? "audio/" : "video/";
    const extensions =
      mode === "music"
        ? /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i
        : /\.(mp4|webm|m4v|mov|ogv|mkv)$/i;
    const files = [...fileList]
      .filter(
        (file) => file.type.startsWith(prefix) || extensions.test(file.name),
      )
      .slice(0, 200);
    if (!files.length) {
      tell("没有找到支持的媒体文件，请选择音频或视频文件。");
      return;
    }
    await replaceItems(
      files.map((file) => ({
        key: fileKey(file),
        name: file.name,
        url: URL.createObjectURL(file),
        local: true,
      })),
    );
  }
  async function openUrl(raw) {
    const url = normalizeUrl(raw);
    setMode("video");
    $("direct-url").value = url;
    await replaceItems([
      {
        key: `url:${url}`,
        name: new URL(url).pathname.split("/").pop() || new URL(url).hostname,
        url,
        local: false,
      },
    ]);
  }
  function setMode(nextMode) {
    if (mode !== nextMode) {
      saveProgress(current(), true).catch((error) => tell(error.message));
      current().element.pause();
      mode = nextMode;
    }
    const music = mode === "music";
    $("music-art").hidden = !music;
    $("video").hidden = music;
    $("media-eyebrow").textContent = music ? "01 / MUSIC" : "02 / VIDEO";
    $("media-heading").textContent = music
      ? "让喜欢的声音，陪你一会。"
      : "把此刻，交给一段好画面。";
    $("media-description").textContent = music
      ? "选择本地音频，给今天配一段自己的背景音乐。"
      : "本地影片、媒体直链，在自己的节奏里慢慢看。";
    $("queue-title").textContent = music ? "我的歌单" : "播放列表";
    $("picker-title").textContent = music ? "选择音频文件" : "选择视频文件";
    $("media-files").accept = music
      ? "audio/*,.mp3,.wav,.ogg,.m4a,.flac"
      : "video/*,.mp4,.webm,.mov,.mkv";
    $("direct-form").hidden = music;
    $("capture").hidden = music;
    $("fullscreen").hidden = music;
    $("format-note").textContent = music
      ? "格式支持取决于浏览器，一般可播放 MP3、WAV、OGG 等。"
      : "格式与编码支持取决于浏览器。视频直链可能受防盗链、登录或跨域策略限制。";
    paintList();
  }

  for (const [name, session] of Object.entries(sessions)) {
    for (const event of [
      "timeupdate",
      "durationchange",
      "loadeddata",
      "play",
      "pause",
      "ended",
      "emptied",
    ]) {
      session.element.addEventListener(event, () => {
        if (mode === name) paint();
      });
    }
    session.element.addEventListener("timeupdate", () =>
      saveProgress(session).catch((error) => tell(error.message)),
    );
    session.element.addEventListener("pause", () =>
      saveProgress(session, true).catch((error) => tell(error.message)),
    );
    session.element.addEventListener("ended", () => {
      saveProgress(session, true).catch((error) => tell(error.message));
      if (!session.element.loop && session.index < session.items.length - 1)
        load(session, session.index + 1, true);
    });
    session.element.addEventListener("error", () => {
      if (!session.items[session.index]) return;
      tell(
        "无法播放此媒体：文件可能损坏、编码不受浏览器支持，或直链访问受限。",
      );
      if (mode === name) paint();
    });
  }
  $("media-files").addEventListener("change", (event) => {
    chooseFiles(event.target.files).catch((error) => tell(error.message));
    event.target.value = "";
  });
  $("drop-zone").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("drop-zone").classList.add("dragging");
  });
  $("drop-zone").addEventListener("dragleave", () =>
    $("drop-zone").classList.remove("dragging"),
  );
  $("drop-zone").addEventListener("drop", (event) => {
    event.preventDefault();
    $("drop-zone").classList.remove("dragging");
    chooseFiles(event.dataTransfer.files).catch((error) => tell(error.message));
  });
  $("play").addEventListener("click", () =>
    current().element.paused ? tryPlay(current()) : current().element.pause(),
  );
  $("previous").addEventListener("click", () =>
    load(
      current(),
      (current().index - 1 + current().items.length) % current().items.length,
      true,
    ),
  );
  $("next").addEventListener("click", () =>
    load(current(), (current().index + 1) % current().items.length, true),
  );
  $("seek").addEventListener("input", (event) => {
    if (Number.isFinite(current().element.duration))
      current().element.currentTime =
        (Number(event.target.value) * current().element.duration) / 100;
  });
  $("seek").addEventListener("change", () =>
    saveProgress(current(), true).catch((error) => tell(error.message)),
  );
  $("volume").addEventListener("input", (event) => {
    settings.volume = Number(event.target.value);
    storeSettings();
  });
  $("speed").addEventListener("change", (event) => {
    settings.speed = Number(event.target.value);
    storeSettings();
  });
  $("repeat").addEventListener("click", () => {
    settings.repeat = !settings.repeat;
    storeSettings();
  });
  $("direct-form").addEventListener("submit", (event) => {
    event.preventDefault();
    openUrl($("direct-url").value).catch((error) => tell(error.message));
  });
  $("fullscreen").addEventListener("click", () =>
    $("video")
      .requestFullscreen()
      .catch(() => tell("当前环境不支持全屏。")),
  );
  document.addEventListener("fullscreenchange", () => {
    $("video").controls = document.fullscreenElement === $("video");
  });
  $("capture").addEventListener("click", async () => {
    try {
      const video = $("video");
      if (!video.videoWidth) throw new Error("请先载入视频。");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      await saveCanvas(
        canvas,
        `stmh-frame-${Math.floor(video.currentTime)}.png`,
      );
      tell("已保存当前画面。");
    } catch {
      tell("无法保存画面。在线媒体可能不允许跨域截图，请使用本地文件。");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.code !== "Space" ||
      event.target.closest("input, select, textarea, button, a") ||
      $("media-panel").hidden
    )
      return;
    if (current().items.length) {
      event.preventDefault();
      $("play").click();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden)
      for (const session of Object.values(sessions))
        saveProgress(session, true).catch(() => {});
  });
  window.addEventListener("pagehide", () => {
    for (const session of Object.values(sessions)) {
      saveProgress(session, true).catch(() => {});
      for (const item of session.items)
        if (item.local) URL.revokeObjectURL(item.url);
    }
  });
  return { setMode, openUrl };
}
