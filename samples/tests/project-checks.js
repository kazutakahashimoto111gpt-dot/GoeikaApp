"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(
    path.join(projectRoot, relativePath),
    "utf8"
  );
}

function checkJavaScriptSyntax(relativePath) {
  assert.doesNotThrow(
    () => new vm.Script(
      readProjectFile(relativePath),
      { filename: relativePath }
    ),
    `${relativePath} に構文エラーがあります`
  );
}

for (const relativePath of [
  "notes.js",
  "script.js",
  "sw.js"
]) {
  checkJavaScriptSyntax(relativePath);
}

const notesContext = {};
vm.createContext(notesContext);
new vm.Script(
  `${readProjectFile("notes.js")}\n` +
  "this.testNotes = notes; " +
  "this.testKeyboardLayout = keyboardLayout;",
  { filename: "notes.js" }
).runInContext(notesContext);

const notes = Array.from(notesContext.testNotes);
const keyboardLayout = notesContext.testKeyboardLayout;

assert.equal(notes.length, 25, "音符は25鍵分必要です");

notes.forEach((note, index) => {
  const expectedFrequency = 220 * Math.pow(2, index / 12);

  assert.ok(
    Math.abs(note.frequency - expectedFrequency) < 0.001,
    `${index + 1}番目の周波数が半音階と一致しません`
  );
});

for (const [keyType, expectedCount] of [
  ["white", 15],
  ["black", 10]
]) {
  const keyIndexes = notes
    .filter(note => note.keyType === keyType)
    .map(note => note.keyIndex);

  assert.equal(
    keyIndexes.length,
    expectedCount,
    `${keyType}鍵の数が正しくありません`
  );

  assert.deepEqual(
    keyIndexes,
    Array.from({ length: expectedCount }, (_, index) => index),
    `${keyType}鍵のkeyIndexが連番ではありません`
  );
}

for (const [areaName, expectedCount] of [
  ["whiteKeyAreas", 15],
  ["blackKeyAreas", 10],
  ["nonPlayableBlackKeyAreas", 2]
]) {
  const areas = Array.from(keyboardLayout[areaName]);

  assert.equal(
    areas.length,
    expectedCount,
    `${areaName}の領域数が正しくありません`
  );

  areas.forEach((area, index) => {
    assert.ok(
      area.left >= 0 &&
      area.right <= 1 &&
      area.left < area.right,
      `${areaName}[${index}]の範囲が正しくありません`
    );
  });
}

const pngBuffer = fs.readFileSync(
  path.join(projectRoot, "keyboard-chart.png")
);
const pngWidth = pngBuffer.readUInt32BE(16);
const pngHeight = pngBuffer.readUInt32BE(20);

assert.equal(
  pngWidth,
  keyboardLayout.imageWidth,
  "鍵盤画像の幅と鍵判定データが一致しません"
);
assert.equal(
  pngHeight,
  keyboardLayout.imageHeight,
  "鍵盤画像の高さと鍵判定データが一致しません"
);

const indexHtml = readProjectFile("index.html");
const localAssetPaths = Array.from(
  indexHtml.matchAll(/(?:src|href)="([^"#]+)"/g),
  match => match[1]
).filter(assetPath => !/^[a-z]+:/i.test(assetPath));

localAssetPaths.forEach(assetPath => {
  const normalizedPath = assetPath.replace(/^\.\//, "");

  assert.ok(
    fs.existsSync(path.join(projectRoot, normalizedPath)),
    `HTMLから参照している${assetPath}が存在しません`
  );
});

const manifest = JSON.parse(readProjectFile("manifest.json"));
const themeColorMatch = indexHtml.match(
  /name="theme-color"[\s\S]*?content="([^"]+)"/
);

assert.ok(themeColorMatch, "HTMLにtheme-colorがありません");
assert.equal(
  themeColorMatch[1],
  manifest.theme_color,
  "HTMLとmanifest.jsonのテーマ色が一致しません"
);
assert.equal(
  manifest.background_color,
  manifest.theme_color,
  "PWAの背景色とテーマ色が一致しません"
);

const serviceWorker = readProjectFile("sw.js");
const precacheBlockMatch = serviceWorker.match(
  /const FILES_TO_CACHE = \[([\s\S]*?)\];/
);

assert.ok(precacheBlockMatch, "FILES_TO_CACHEが見つかりません");

const precachePaths = Array.from(
  precacheBlockMatch[1].matchAll(/"([^"]+)"/g),
  match => match[1]
);

assert.equal(
  new Set(precachePaths).size,
  precachePaths.length,
  "FILES_TO_CACHEに重複があります"
);
assert.ok(
  precachePaths.includes("./icons/favicon-48.png"),
  "faviconが事前キャッシュに含まれていません"
);
assert.ok(
  !precachePaths.includes("./index.html"),
  "ルートHTMLを二重に事前キャッシュしています"
);

precachePaths
  .filter(assetPath => assetPath !== "./")
  .forEach(assetPath => {
    const normalizedPath = assetPath.replace(/^\.\//, "");

    assert.ok(
      fs.existsSync(path.join(projectRoot, normalizedPath)),
      `事前キャッシュ対象の${assetPath}が存在しません`
    );
  });

assert.equal(
  manifest.start_url,
  "./",
  "PWAの開始URLと事前キャッシュするルートURLが一致しません"
);

console.log("Project checks passed.");
