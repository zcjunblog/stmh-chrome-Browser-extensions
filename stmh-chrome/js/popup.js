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
