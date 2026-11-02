import { normalizeUrl } from "./core.mjs";

export const parserProvider = Object.freeze({
  name: "TXNP 弹幕播放器",
  homepage: "https://art.txnp.cn/",
  checked: "2026-11-03",
});

export const playbackPatterns = [
  "*://*.iqiyi.com/v_*",
  "*://*.iqiyi.com/w_*",
  "*://v.qq.com/x/cover/*",
  "*://v.qq.com/x/page/*",
  "*://v.youku.com/v_show/*",
  "*://*.mgtv.com/b/*",
  "*://*.bilibili.com/video/*",
  "*://*.bilibili.com/bangumi/play/*",
];

export function videoPage(value) {
  let url;
  try {
    url = new URL(normalizeUrl(value));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase(),
    path = url.pathname;
  const domain = (name) => host === name || host.endsWith(`.${name}`);
  let platform;
  if (domain("iqiyi.com") && /^\/(?:v|w)_[\w]+\.html$/i.test(path))
    platform = "爱奇艺";
  else if (
    host === "v.qq.com" &&
    /^\/x\/(?:cover|page)\/[\w/.-]+\.html$/i.test(path)
  )
    platform = "腾讯视频";
  else if (
    host === "v.youku.com" &&
    /^\/v_show\/id_[\w=.-]+\.html$/i.test(path)
  )
    platform = "优酷";
  else if (domain("mgtv.com") && /^\/b\/\d+\/\d+\.html$/i.test(path))
    platform = "芒果TV";
  else if (
    domain("bilibili.com") &&
    /^\/(?:video\/(?:BV[\w]+|av\d+)|bangumi\/play\/(?:ep|ss)\d+)\/?$/i.test(
      path,
    )
  )
    platform = "哔哩哔哩";
  else return null;
  const params = new URLSearchParams();
  // Preserve episode identity, but never forward unrelated query strings or fragments.
  if (
    platform === "哔哩哔哩" &&
    /^[1-9]\d{0,3}$/.test(url.searchParams.get("p") || "")
  )
    params.set("p", url.searchParams.get("p"));
  if (
    platform === "腾讯视频" &&
    /^[a-zA-Z0-9]{1,30}$/.test(url.searchParams.get("vid") || "")
  )
    params.set("vid", url.searchParams.get("vid"));
  url.search = params.toString();
  url.hash = "";
  return { platform, url: url.href };
}

export function parserUrl(value) {
  const page = videoPage(value);
  if (!page)
    throw new Error(
      "请使用爱奇艺、腾讯视频、优酷、芒果TV或B站的完整视频播放页地址。",
    );
  const target = new URL(parserProvider.homepage);
  target.searchParams.set("url", page.url);
  return target.href;
}
