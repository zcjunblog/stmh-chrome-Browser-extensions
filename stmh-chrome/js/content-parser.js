(() => {
  if (window.top !== window || document.getElementById("stmh-page-parser"))
    return;
  let lastUrl = "",
    dismissed = "",
    generation = 0;
  const host = document.createElement("div");
  host.id = "stmh-page-parser";
  host.style.cssText =
    "position:fixed;right:18px;top:35%;z-index:2147483647;display:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `:host{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif}*{box-sizing:border-box}.box{display:flex;align-items:center;background:#222724;color:#fff;border:1px solid #ffffff35;border-radius:12px;box-shadow:0 5px 20px #0003;padding:4px}button{font:inherit;cursor:pointer;border:0;background:transparent;color:inherit;padding:9px}button:focus-visible{outline:2px solid #ff9b68;outline-offset:-2px;border-radius:7px}.mark{color:#ff9b68;font-weight:800;margin-right:7px}.close{padding:7px;color:#c3c9c1}button:disabled{opacity:.5;cursor:wait}.status{max-width:230px;background:#222724;color:#fff;font-size:11px;padding:8px;border-radius:8px;margin-top:5px;overflow-wrap:anywhere}.status:empty{display:none}`;
  const box = document.createElement("div");
  box.className = "box";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "视听魔盒：一键解析当前视频");
  button.title = "通过 TXNP 第三方播放器打开当前视频网址";
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = "m•";
  button.append(mark, "一键解析");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "×";
  close.setAttribute("aria-label", "隐藏本页解析按钮");
  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("role", "status");
  box.append(button, close);
  shadow.append(style, box, status);
  document.documentElement.append(host);
  close.addEventListener("click", () => {
    dismissed = location.href;
    host.style.display = "none";
  });
  button.addEventListener("click", async (event) => {
    // The host page can access this DOM; only a genuine user click may forward its URL.
    if (!event.isTrusted) return;
    button.disabled = true;
    status.textContent = "";
    try {
      const result = await chrome.runtime.sendMessage({
        type: "parser:open",
        url: location.href,
      });
      if (!result?.ok)
        throw new Error(result?.error || "解析入口打开失败，请重新加载网页。");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  async function refresh() {
    if (lastUrl === location.href) return;
    lastUrl = location.href;
    const sequence = ++generation;
    host.style.display = "none";
    status.textContent = "";
    try {
      const result = await chrome.runtime.sendMessage({
        type: "parser:status",
        url: location.href,
      });
      if (sequence !== generation) return;
      host.style.display =
        result?.ok && result.data && dismissed !== location.href
          ? "block"
          : "none";
    } catch {
      /* An updated/uninstalled extension must not interfere with the host page. */
    }
  }
  refresh();
  // Supported platforms often change episode URLs without reloading the document.
  let timer = setInterval(refresh, 1000);
  window.addEventListener("pagehide", () => clearInterval(timer));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      lastUrl = "";
      refresh();
      timer = setInterval(refresh, 1000);
    }
  });
})();
