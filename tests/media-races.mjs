import assert from "node:assert/strict";

// Delay only delivery of genuine Chrome storage responses. No fake media or storage API.
async function gateRestoration(page, seedFirst = false) {
  await page.evaluate((seed) => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    const gate = { pending: [], returned: 0, send, seed };
    window.progressGate = gate;
    chrome.runtime.sendMessage = async (message) => {
      if (message.type === "progress:get" && gate.seed) {
        gate.seed = false;
        await send({ type: "progress:save", key: message.key, time: 1 });
        gate.savedKey = message.key;
      }
      const result = await send(message);
      if (message.type === "progress:get") {
        await new Promise((resolve) => gate.pending.push(resolve));
        gate.returned++;
      }
      return result;
    };
  }, seedFirst);
}

export async function verifyMediaRaces(page, base, bytes) {
  const observations = {};
  const files = [
    { name: "first.webm", mimeType: "video/webm", buffer: bytes },
    { name: "second.webm", mimeType: "video/webm", buffer: bytes },
  ];
  await page.goto(`${base}/toolbox.html?tool=video`);
  await page.locator("#media-files").setInputFiles(files);
  await page.waitForFunction(
    () =>
      document.querySelector("#video").readyState >= 2 &&
      !document.querySelector("#play").disabled,
  );
  await gateRestoration(page);
  await page.locator("#next").click();
  await page.waitForFunction(() => window.progressGate.pending.length === 1);
  await page.locator("[data-tool=music]").click();
  await page.evaluate(() =>
    window.progressGate.pending.splice(0).forEach((resolve) => resolve()),
  );
  await page.waitForFunction(() => window.progressGate.returned === 1);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  observations.hiddenVideoPaused = await page
    .locator("#video")
    .evaluate((video) => video.hidden && video.paused);

  await page.goto(`${base}/toolbox.html?tool=video`);
  await page.locator("#media-files").setInputFiles(files);
  await page.waitForFunction(
    () =>
      document.querySelector("#video").readyState >= 2 &&
      !document.querySelector("#play").disabled,
  );
  await gateRestoration(page, true);
  await page.locator("#next").click();
  await page.waitForFunction(() => window.progressGate.pending.length === 1);
  await page.locator("#next").click();
  await page.waitForFunction(() => window.progressGate.pending.length === 2);
  observations.skippedTrackProgress = await page.evaluate(() =>
    window.progressGate
      .send({ type: "progress:get", key: window.progressGate.savedKey })
      .then((result) => result.data),
  );
  await page.evaluate(() =>
    window.progressGate.pending.splice(0).forEach((resolve) => resolve()),
  );
  await page.waitForFunction(() => window.progressGate.returned === 2);
  assert.deepEqual(observations, {
    hiddenVideoPaused: true,
    skippedTrackProgress: 1,
  });
}
