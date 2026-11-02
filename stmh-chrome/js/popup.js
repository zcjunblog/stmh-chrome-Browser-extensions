document.querySelector("#save-current").addEventListener("click", async () => {
  const feedback = document.querySelector("#feedback");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const result = await chrome.runtime.sendMessage({
      type: "bookmark:add",
      item: { title: tab?.title, url: tab?.url },
    });
    if (!result.ok) throw new Error(result.error);
    feedback.textContent = "已收藏，在「随手直达」中查看。";
  } catch (error) {
    feedback.textContent =
      error.message || "此页面暂不支持收藏，请在普通网页重试。";
  }
});
import { videoPage } from "./parser.mjs";

const parse = document.querySelector("#parse-current");
chrome.tabs
  .query({ active: true, currentWindow: true })
  .then(([tab]) => {
    const page = videoPage(tab?.url);
    parse.disabled = !page;
    document.querySelector("#current-video").textContent = page
      ? `已识别：${page.platform}`
      : "请先打开视频播放页";
  })
  .catch(() => {
    document.querySelector("#current-video").textContent = "请先打开视频播放页";
  });
parse.addEventListener("click", async () => {
  const feedback = document.querySelector("#feedback");
  parse.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const result = await chrome.runtime.sendMessage({
      type: "parser:open",
      url: tab?.url,
    });
    if (!result?.ok) throw new Error(result?.error || "解析入口打开失败。");
    feedback.textContent = "已打开 TXNP 解析入口。";
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    parse.disabled = false;
  }
});
