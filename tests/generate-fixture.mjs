// Regenerate the original, synthetic test video. No third-party media is bundled.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d"),
      stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const chunks = [];
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    for (let frame = 0; frame < 40; frame++) {
      context.fillStyle = "#f3eee4";
      context.fillRect(0, 0, 320, 180);
      context.fillStyle = "#d65b24";
      context.fillRect(frame * 5, 40, 70, 100);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return [
      ...new Uint8Array(
        await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
      ),
    ];
  });
  await mkdir("tests/fixtures", { recursive: true });
  await writeFile("tests/fixtures/sample.webm", Buffer.from(bytes));
} finally {
  await browser.close();
}
