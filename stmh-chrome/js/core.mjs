export function normalizeUrl(value) {
  if (
    typeof value !== "string" ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value.length > 4096
  ) {
    throw new Error("请输入有效的 HTTP 或 HTTPS 地址。");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入完整网址，例如 https://example.com。");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("仅支持不含账号密码的 HTTP 或 HTTPS 地址。");
  }
  return url.href;
}

export function addBookmark(items, input) {
  const title = String(input.title ?? "")
    .trim()
    .slice(0, 100);
  if (!title) throw new Error("请填写收藏名称。");
  const url = normalizeUrl(input.url);
  const existing = items.find((item) => item.url === url);
  if (!existing && items.length >= 100)
    throw new Error("最多保存 100 个收藏，请先删除不再使用的链接。");
  const item = { id: existing?.id || crypto.randomUUID(), title, url };
  return existing
    ? items.map((entry) => (entry.id === existing.id ? item : entry))
    : [...items, item];
}

export function fileKey(file) {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

export function resumeTime(saved, duration) {
  return Number.isFinite(saved) &&
    Number.isFinite(duration) &&
    saved > 0 &&
    saved < duration - Math.min(2, duration * 0.02)
    ? saved
    : 0;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds),
    hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60),
    rest = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}
