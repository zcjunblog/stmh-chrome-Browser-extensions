import test from "node:test";
import assert from "node:assert/strict";
import { videoPage, parserUrl } from "../stmh-chrome/js/parser.mjs";

test("webpage parsing recognizes playback pages without sending tracking parameters", () => {
  assert.deepEqual(
    videoPage("https://www.iqiyi.com/v_1fb7mjixsos.html?from=tracking#ignored"),
    { platform: "爱奇艺", url: "https://www.iqiyi.com/v_1fb7mjixsos.html" },
  );
  assert.equal(
    videoPage("https://v.qq.com/x/cover/abc/def.html?vid=xyz&token=private")
      .url,
    "https://v.qq.com/x/cover/abc/def.html?vid=xyz",
  );
  assert.equal(
    videoPage(
      "https://www.bilibili.com/video/BV1xx411c7mu/?p=2&session=private",
    ).url,
    "https://www.bilibili.com/video/BV1xx411c7mu/?p=2",
  );
  assert.equal(
    videoPage("https://v.youku.com/v_show/id_XND.html").platform,
    "优酷",
  );
  assert.equal(
    videoPage("https://www.mgtv.com/b/123/456.html").platform,
    "芒果TV",
  );
});

test("a lookalike host, login page or credential-bearing URL cannot be sent to a parser", () => {
  for (const url of [
    "https://www.iqiyi.com.evil.example/v_a.html",
    "https://evil.example/?next=https://www.iqiyi.com/v_a.html",
    "https://www.iqiyi.com/",
    "https://v.qq.com/login",
    "javascript:alert(1)",
    "https://user:password@www.iqiyi.com/v_a.html",
  ]) {
    assert.equal(videoPage(url), null);
    assert.throws(() => parserUrl(url));
  }
});

test("the built-in public parser receives exactly one encoded, canonical playback URL", () => {
  const url = new URL(
    parserUrl("https://www.bilibili.com/video/BV1xx411c7mu?p=2&token=private"),
  );
  assert.equal(url.origin, "https://art.txnp.cn");
  assert.deepEqual(
    [...url.searchParams],
    [["url", "https://www.bilibili.com/video/BV1xx411c7mu?p=2"]],
  );
});
