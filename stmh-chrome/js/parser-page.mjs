import { videoPage } from "./parser.mjs";
const form = document.querySelector("#parser-form"),
  feedback = document.querySelector("#feedback");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const source = document.querySelector("#page-url").value;
    if (!videoPage(source))
      throw new Error(
        "请粘贴视频网站的完整播放页网址，而不是首页或媒体文件地址。",
      );
    const result = await chrome.runtime.sendMessage({
      type: "parser:open",
      url: source,
    });
    if (!result?.ok)
      throw new Error(result?.error || "无法打开解析入口，请重试。");
    feedback.textContent =
      "已在新标签页打开 TXNP 解析入口；是否播放成功请以该页面为准。";
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
