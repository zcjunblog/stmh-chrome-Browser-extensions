import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  cpSync,
  rmSync,
  readFileSync,
  unlinkSync,
  symlinkSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

test("two builds have identical ZIP bytes and include a checksum", () => {
  const root = mkdtempSync(path.join(tmpdir(), "stmh-package-"));
  try {
    for (const name of ["a", "b"])
      execFileSync("python3", [
        "scripts/package.py",
        "--out-dir",
        path.join(root, name),
      ]);
    assert.deepEqual(
      readFileSync(path.join(root, "a/stmh-toolbox-1.0.0.zip")),
      readFileSync(path.join(root, "b/stmh-toolbox-1.0.0.zip")),
    );
    assert.match(
      readFileSync(path.join(root, "a/SHA256SUMS"), "utf8"),
      /^[a-f0-9]{64}  stmh-toolbox-1.0.0.zip\n$/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("packaging refuses a missing runtime module and does not publish a broken archive", () => {
  const root = mkdtempSync(path.join(tmpdir(), "stmh-missing-"));
  try {
    const source = path.join(root, "source");
    cpSync("stmh-chrome", source, { recursive: true });
    unlinkSync(path.join(source, "js/core.mjs"));
    const result = spawnSync(
      "python3",
      [
        "scripts/package.py",
        "--source",
        source,
        "--out-dir",
        path.join(root, "out"),
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /core.mjs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("packaging refuses symlinks to files outside the extension", () => {
  const root = mkdtempSync(path.join(tmpdir(), "stmh-link-"));
  try {
    const source = path.join(root, "source");
    cpSync("stmh-chrome", source, { recursive: true });
    symlinkSync(path.resolve("README.md"), path.join(source, "leak.txt"));
    const result = spawnSync(
      "python3",
      [
        "scripts/package.py",
        "--source",
        source,
        "--out-dir",
        path.join(root, "out"),
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /符号链接/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
