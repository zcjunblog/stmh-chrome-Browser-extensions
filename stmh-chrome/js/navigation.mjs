import { normalizeUrl } from "./core.mjs";

const sites = [
  {
    title: "网易云音乐",
    url: "https://music.163.com/",
    category: "音乐",
    mark: "云",
    color: "#bd3434",
  },
  {
    title: "QQ 音乐",
    url: "https://y.qq.com/",
    category: "音乐",
    mark: "Q",
    color: "#128365",
  },
  {
    title: "哔哩哔哩",
    url: "https://www.bilibili.com/",
    category: "视频",
    mark: "b",
    color: "#227ca2",
  },
  {
    title: "豆瓣电影",
    url: "https://movie.douban.com/",
    category: "电影",
    mark: "豆",
    color: "#387846",
  },
  {
    title: "Unsplash",
    url: "https://unsplash.com/",
    category: "摄影 / 壁纸",
    mark: "U",
    color: "#555863",
  },
  {
    title: "Pexels",
    url: "https://www.pexels.com/",
    category: "摄影 / 壁纸",
    mark: "P",
    color: "#218375",
  },
  {
    title: "简约导航",
    url: "https://nav.gs/",
    category: "导航",
    mark: "n",
    color: "#b95425",
  },
  {
    title: "个人博客",
    url: "https://x4v.cn/",
    category: "Zeno 的记录",
    mark: "Z",
    color: "#71634d",
  },
];

export async function initNavigation(tell) {
  const $ = (id) => document.getElementById(id);
  let bookmarks = [];
  async function request(type, extra = {}) {
    const result = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok)
      throw new Error(result?.error || "操作失败，请重新打开扩展。");
    return result.data;
  }
  function card(item, custom = false) {
    let url;
    try {
      url = normalizeUrl(item.url);
    } catch {
      return null;
    }
    const node = document.createElement("div");
    node.className = "site-card";
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", item.title);
    const icon = document.createElement("span");
    icon.className = "site-icon";
    icon.textContent = item.mark || item.title.slice(0, 1);
    if (item.color) icon.style.color = item.color;
    const text = document.createElement("span");
    text.className = "site-text";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const desc = document.createElement("small");
    desc.textContent = item.category || new URL(url).hostname;
    text.append(title, desc);
    link.append(icon, text);
    node.append(link);
    if (custom) {
      const button = document.createElement("button");
      button.className = "remove-bookmark";
      button.textContent = "×";
      button.setAttribute("aria-label", `删除 ${item.title}`);
      button.addEventListener("click", async () => {
        try {
          bookmarks = await request("bookmark:remove", { id: item.id });
          paint();
          tell("已删除收藏。");
        } catch (error) {
          tell(error.message);
        }
      });
      node.append(button);
    }
    return node;
  }
  function paint() {
    const query = $("site-search").value.trim().toLowerCase();
    const match = (item) =>
      `${item.title} ${item.category || ""} ${item.url}`
        .toLowerCase()
        .includes(query);
    $("default-sites").replaceChildren(
      ...sites
        .filter(match)
        .map((item) => card(item))
        .filter(Boolean),
    );
    const filtered = bookmarks.filter(match);
    $("bookmarks").replaceChildren(
      ...filtered.map((item) => card(item, true)).filter(Boolean),
    );
    $("bookmark-count").textContent = `${bookmarks.length} / 100`;
    $("bookmark-empty").hidden = filtered.length > 0;
    $("bookmark-empty").textContent = query
      ? "没有找到匹配的收藏。"
      : "把常用网站添进来，也可以在网页上右键收藏。";
  }
  $("site-search").addEventListener("input", paint);
  $("bookmark-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      bookmarks = await request("bookmark:add", {
        item: {
          title: $("bookmark-title").value,
          url: $("bookmark-url").value,
        },
      });
      $("bookmark-form").reset();
      paint();
      tell("已保存收藏。");
    } catch (error) {
      tell(error.message);
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.bookmarks) {
      bookmarks = changes.bookmarks.newValue || [];
      paint();
    }
  });
  bookmarks = await request("bookmark:list");
  paint();
}
