import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { verifyMediaRaces } from "./media-races.mjs";
import { verifyWebpageParser } from "./parser-browser.mjs";

const root = await mkdtemp(path.join(tmpdir(), "stmh-browser-"));
let context;
const errors = [];
const videoBytes = await readFile("tests/fixtures/sample.webm");
const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "video/webm");
  response.end(videoBytes);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  execFileSync("python3", [
    "scripts/package.py",
    "--out-dir",
    path.join(root, "release"),
  ]);
  execFileSync("python3", [
    "-m",
    "zipfile",
    "-e",
    path.join(
      root,
      `release/stmh-toolbox-${JSON.parse(await readFile("stmh-chrome/manifest.json", "utf8")).version}.zip`,
    ),
    path.join(root, "unpacked"),
  ]);
  const extension = path.join(root, "unpacked/stmh-chrome");
  context = await chromium.launchPersistentContext(root, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1360, height: 900 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker", { timeout: 10000 }));
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/toolbox.html?tool=navigation`);
  await page.getByRole("heading", { name: "常用的，放在手边。" }).waitFor();
  await page.getByLabel("网站名称").fill("Test bookmark");
  await page.getByLabel("网站地址").fill("https://example.com/");
  await page.getByRole("button", { name: "添加收藏", exact: true }).click();
  await page.getByRole("link", { name: "Test bookmark" }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: "Test bookmark" }).waitFor();
  await page.getByLabel("网站名称").fill("Invalid");
  await page.getByLabel("网站地址").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "添加收藏", exact: true }).click();
  assert.equal(
    await page.getByRole("link", { name: "Invalid", exact: true }).count(),
    0,
  );
  const rejected = await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "bookmark:add",
      item: { title: "Bad", url: "javascript:alert(1)" },
    }),
  );
  assert.equal(rejected.ok, false);
  const addResults = await page.evaluate(() =>
    Promise.all(
      ["one", "two"].map((name) =>
        chrome.runtime.sendMessage({
          type: "bookmark:add",
          item: { title: name, url: `https://${name}.example.com` },
        }),
      ),
    ),
  );
  assert.ok(addResults.every((result) => result.ok));
  const stored = await page.evaluate(() =>
    chrome.runtime.sendMessage({ type: "bookmark:list" }),
  );
  assert.ok(
    stored.data.some((item) => item.title === "one") &&
      stored.data.some((item) => item.title === "two"),
  );

  await page.goto(`${base}/toolbox.html?tool=music`);
  // PCM audio generated in-memory: no network or external fixture dependency.
  const sampleRate = 8000,
    samples = sampleRate * 12;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 220) / sampleRate) * 2000),
      44 + i * 2,
    );
  const audioFile = path.join(root, "test-song.wav");
  await writeFile(audioFile, wav);
  await page.locator("#media-files").setInputFiles(audioFile);
  await page.waitForFunction(
    () => document.querySelector("#audio").readyState >= 1,
  );
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#audio").paused &&
      document.querySelector("#audio").currentTime > 0,
  );
  // Internal navigation does not reload the document or interrupt music.
  await page.getByRole("link", { name: /壁纸/ }).click();
  assert.equal(
    await page.locator("#audio").evaluate((audio) => audio.paused),
    false,
  );
  await page.getByRole("link", { name: /音乐/ }).click();
  await page.evaluate(() => {
    const audio = document.querySelector("#audio");
    audio.currentTime = 5;
    audio.pause();
  });
  await page.waitForFunction(async () =>
    Object.values(
      (await chrome.storage.local.get("progress")).progress || {},
    ).some((value) => value.time >= 5),
  );
  await page.reload();
  await page.locator("#media-files").setInputFiles(audioFile);
  await page.waitForFunction(
    () => document.querySelector("#audio").currentTime >= 5,
  );
  await page.locator("#media-files").setInputFiles({
    name: "invalid.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("not media"),
  });
  await page
    .getByRole("status")
    .filter({ hasText: /无法播放/ })
    .waitFor();

  await page.goto(`${base}/toolbox.html?tool=video`);
  await page.locator("#media-files").setInputFiles({
    name: "sample.webm",
    mimeType: "video/webm",
    buffer: videoBytes,
  });
  await page.waitForFunction(
    () => document.querySelector("#video").readyState >= 2,
  );
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#video").currentTime > 0,
  );
  await page.getByRole("button", { name: "全屏", exact: true }).click();
  await page.waitForFunction(
    () =>
      !!document.fullscreenElement && document.querySelector("#video").controls,
  );
  assert.equal(
    await page.locator("#video").evaluate((video) => video.controls),
    true,
  );
  await page.evaluate(() => document.exitFullscreen());
  const frameDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存当前画面" }).click();
  const frame = await frameDownload;
  assert.ok(frame.suggestedFilename().endsWith(".png"));
  await page
    .getByLabel("媒体直链", { exact: true })
    .fill(`http://127.0.0.1:${server.address().port}/sample.webm`);
  await page.getByRole("button", { name: "打开", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#video").src.startsWith("http://127.0.0.1:") &&
      document.querySelector("#video").readyState >= 2,
  );
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#video").currentTime > 0,
  );

  await page.goto(`${base}/toolbox.html?tool=wallpaper`);
  await page.getByLabel("导出尺寸").selectOption("3840x2160");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载壁纸" }).click();
  const download = await downloadPromise;
  const file = await readFile(await download.path());
  assert.equal(file.subarray(1, 4).toString(), "PNG");
  assert.equal(file.readUInt32BE(16), 3840);
  assert.equal(file.readUInt32BE(20), 2160);
  await page.evaluate(() => scrollTo(0, 0));
  await mkdir(process.env.STMH_SCREENSHOTS || "test-results", {
    recursive: true,
  });
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/wallpaper.png`,
    fullPage: true,
  });
  await page.goto(`${base}/popup.html`);
  await page.setViewportSize({ width: 400, height: 640 });
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/popup.png`,
    fullPage: true,
  });
  await page.goto(`${base}/toolbox.html?tool=music`);
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/music-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.reload();
  await page.locator("#media-files").setInputFiles(audioFile);
  await page.waitForFunction(
    () => document.querySelector("#audio").readyState >= 1,
  );
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/music.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: /导航/ }).click();
  await page
    .getByRole("button", { name: "删除 Test bookmark", exact: true })
    .click();
  assert.equal(
    await page.getByRole("link", { name: "Test bookmark" }).count(),
    0,
  );
  for (const title of ["one", "two"]) {
    await page
      .getByRole("button", { name: `删除 ${title}`, exact: true })
      .click();
  }
  await page.getByRole("link", { name: /壁纸/ }).click();
  await page.getByRole("link", { name: /导航/ }).click();
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/navigation.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: `${process.env.STMH_SCREENSHOTS || "test-results"}/navigation-dark.png`,
    fullPage: true,
  });
  await verifyMediaRaces(page, base, videoBytes);
  await verifyWebpageParser(
    context,
    base,
    process.env.STMH_SCREENSHOTS || "test-results",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: MV3 loads; bookmarks persist and serialize; invalid URLs rejected; real audio/video decode and play; resume; invalid-media feedback; frame capture; 4K PNG; webpage parser button, SPA URL changes and manual parser URL routing; narrow layout; no page errors.",
  );
} catch (error) {
  await mkdir("test-results", { recursive: true });
  const page = context?.pages().at(-1);
  if (page)
    await page
      .screenshot({ path: "test-results/failure.png", fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  if (context) await context.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
