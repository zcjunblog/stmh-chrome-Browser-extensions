import assert from "node:assert/strict";

export async function verifyWebpageParser(context, base, outputDir) {
  // The provider boundary is fulfilled locally: CI tests our integration, never consumes the public service.
  await context.route("https://www.iqiyi.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="zh-CN"><title>公开预告片 · 集成验收页面</title><body><h1>视频播放页</h1><p>此页面仅用于验证扩展按钮，不含第三方视频。</p></body></html>',
    }),
  );
  await context.route("https://art.txnp.cn/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Parser boundary</title><p>Integration URL received.</p>",
    }),
  );
  const source = await context.newPage();
  source.setDefaultTimeout(5000);
  try {
    await source.goto(
      "https://www.iqiyi.com/v_1fb7mjixsos.html?tracking=private#ignored",
    );
    const button = source.getByRole("button", {
      name: "视听魔盒：一键解析当前视频",
      exact: true,
    });
    await button.waitFor();
    const tabPromise = context.waitForEvent("page");
    await button.click();
    const parsed = await tabPromise;
    await parsed.waitForURL("https://art.txnp.cn/**");
    assert.equal(
      new URL(parsed.url()).searchParams.get("url"),
      "https://www.iqiyi.com/v_1fb7mjixsos.html",
    );
    await parsed.close();
    await source.evaluate(() => history.pushState(null, "", "/"));
    await source.locator("#stmh-page-parser").waitFor({ state: "hidden" });
    await source.evaluate(() => history.pushState(null, "", "/v_second.html"));
    await button.waitFor();
    await source.getByRole("button", { name: "隐藏本页解析按钮" }).click();
    await source.locator("#stmh-page-parser").waitFor({ state: "hidden" });
    await source.evaluate(() => history.pushState(null, "", "/v_third.html"));
    await button.waitFor();
    await source.screenshot({ path: `${outputDir}/webpage-button.png` });
    await source.goto(`${base}/parser.html`);
    await source
      .getByLabel("视频网页地址")
      .fill("https://www.iqiyi.com/v_1fb7mjixsos.html");
    const manualPromise = context.waitForEvent("page");
    await source.getByRole("button", { name: "一键解析", exact: true }).click();
    const manual = await manualPromise;
    await manual.waitForURL("https://art.txnp.cn/**");
    assert.equal(
      new URL(manual.url()).searchParams.get("url"),
      "https://www.iqiyi.com/v_1fb7mjixsos.html",
    );
    await manual.close();
    await source.screenshot({
      path: `${outputDir}/parser.png`,
      fullPage: true,
    });
  } finally {
    await source.close();
    await context.unroute("https://www.iqiyi.com/**");
    await context.unroute("https://art.txnp.cn/**");
  }
}
