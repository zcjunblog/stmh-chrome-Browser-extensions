import { createMediaPlayer } from "./media.mjs";
import { initWallpaper } from "./wallpaper.mjs";
import { initNavigation } from "./navigation.mjs";

const feedback = document.querySelector("#feedback");
const tell = (message) => {
  feedback.textContent = message;
};
const media = createMediaPlayer(tell);
initWallpaper(tell);
initNavigation(tell).catch((error) => tell(error.message));
const names = {
  music: "音乐",
  video: "视频",
  wallpaper: "壁纸",
  navigation: "导航",
};
function route(tool) {
  if (!Object.hasOwn(names, tool)) tool = "music";
  document.querySelector("#media-panel").hidden = !["music", "video"].includes(
    tool,
  );
  document.querySelector("#wallpaper-panel").hidden = tool !== "wallpaper";
  document.querySelector("#navigation-panel").hidden = tool !== "navigation";
  if (["music", "video"].includes(tool)) media.setMode(tool);
  document.querySelector("#breadcrumb").textContent =
    `视听魔盒 / ${names[tool]}`;
  document.title = `${names[tool]} · 视听魔盒`;
  for (const link of document.querySelectorAll("[data-tool]")) {
    if (link.dataset.tool === tool) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  tell("");
}

for (const link of document.querySelectorAll("[data-tool], .brand")) {
  link.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const url = new URL(link.href);
    history.pushState(null, "", url);
    route(url.searchParams.get("tool"));
  });
}
window.addEventListener("popstate", () =>
  route(new URL(location.href).searchParams.get("tool")),
);
const params = new URL(location.href).searchParams;
route(params.get("tool"));
if (params.get("media")) {
  media.openUrl(params.get("media")).catch((error) => tell(error.message));
  history.replaceState(null, "", "?tool=video");
}
chrome.storage.session.get("menuError").then(({ menuError }) => {
  if (menuError) {
    tell(menuError);
    chrome.storage.session.remove("menuError");
  }
});
