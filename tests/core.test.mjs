import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUrl,
  addBookmark,
  fileKey,
  resumeTime,
  formatTime,
} from "../stmh-chrome/js/core.mjs";

test("URLs cannot execute scripts, hide credentials or contain control characters", () => {
  assert.equal(
    normalizeUrl(" https://example.com/a?q=中国 "),
    "https://example.com/a?q=%E4%B8%AD%E5%9B%BD",
  );
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "https://a:b@example.com/",
    "https://exa\nmple.com",
    "",
    "not a URL",
  ]) {
    assert.throws(() => normalizeUrl(url));
  }
});

test("bookmarks normalize duplicates without losing other entries", () => {
  const items = [{ id: "1", title: "Old", url: "https://example.com/" }];
  const result = addBookmark(items, {
    title: "New",
    url: "https://example.com",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "1");
  assert.equal(result[0].title, "New");
  assert.equal(items[0].title, "Old");
  assert.equal(
    addBookmark(items, { title: "Second", url: "https://example.org/" }).length,
    2,
  );
});

test("full bookmark collection rejects a new entry but permits updating a duplicate", () => {
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    title: String(i),
    url: `https://example.com/${i}`,
  }));
  assert.throws(
    () => addBookmark(items, { title: "overflow", url: "https://example.org" }),
    /100/,
  );
  assert.equal(
    addBookmark(items, { title: "edited", url: "https://example.com/0" })[0]
      .title,
    "edited",
  );
  assert.throws(() =>
    addBookmark([], { title: "  ", url: "https://example.com/" }),
  );
});

test("different local files with the same filename have isolated resume records", () => {
  assert.notEqual(
    fileKey({ name: "song.mp3", size: 100, lastModified: 1 }),
    fileKey({ name: "song.mp3", size: 200, lastModified: 1 }),
  );
  assert.notEqual(
    fileKey({ name: "song.mp3", size: 100, lastModified: 1 }),
    fileKey({ name: "song.mp3", size: 100, lastModified: 2 }),
  );
});

test("resume accepts a valid position and resets completed or corrupt positions", () => {
  assert.equal(resumeTime(32, 100), 32);
  for (const time of [-1, NaN, Infinity, 99, 100, 200])
    assert.equal(resumeTime(time, 100), 0);
  assert.equal(resumeTime(2, 5), 2);
  assert.equal(resumeTime(32, NaN), 0);
});

test("playback clock handles hour-long media and unset duration", () => {
  assert.equal(formatTime(3661), "1:01:01");
  assert.equal(formatTime(65.8), "1:05");
  assert.equal(formatTime(NaN), "0:00");
});
