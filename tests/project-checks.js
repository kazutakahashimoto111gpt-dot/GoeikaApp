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
  `${readProjectFile("notes.js")}\nthis.testNotes = notes;`,
  { filename: "notes.js" }
).runInContext(notesContext);

const notes = Array.from(notesContext.testNotes);

assert.equal(notes.length, 25, "音符は25音分必要です");

notes.forEach((note, index) => {
  const expectedFrequency = 220 * Math.pow(2, index / 12);

  assert.equal(note.no, index + 1, "音符番号が連番ではありません");
  assert.ok(
    note.xRatio >= 0 &&
    note.xRatio <= 1 &&
    note.yRatio >= 0 &&
    note.yRatio <= 1,
    `${note.no}番目の座標が画像範囲外です`
  );
  assert.ok(
    Math.abs(note.frequency - expectedFrequency) < 0.001,
    `${note.no}番目の周波数が半音階と一致しません`
  );
});

const script = readProjectFile("script.js");
const notePressLayoutsMatch = script.match(
  /const notePressLayouts = \[([\s\S]*?)\];/
);

assert.ok(notePressLayoutsMatch, "押下表示データが見つかりません");
assert.equal(
  (notePressLayoutsMatch[1].match(/lengthRatio/g) || []).length,
  notes.length,
  "音符数と押下表示データ数が一致しません"
);

const indexHtml = readProjectFile("index.html");

assert.ok(
  !indexHtml.includes('id="audioStartOverlay"'),
  "音声開始専用のオーバーレイが残っています"
);

assert.ok(
  !script.includes("audioStartOverlay") &&
  !script.includes("audioStartMessage"),
  "音声開始専用の処理が残っています"
);

const pointerDownIndex = script.indexOf(
  'image.addEventListener(\n  "pointerdown"'
);
const ensureAudioIndex = script.indexOf(
  "await ensureAudioContext()",
  pointerDownIndex
);
const playPointerIndex = script.indexOf(
  "playNoteAtPointer(",
  ensureAudioIndex
);

assert.ok(pointerDownIndex >= 0, "画像のpointerdown処理がありません");
assert.ok(
  ensureAudioIndex > pointerDownIndex,
  "最初の画像タップでAudioContextを開始していません"
);
assert.ok(
  playPointerIndex > ensureAudioIndex,
  "AudioContext開始後に最初のタップを演奏していません"
);

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

const htmlIds = new Set(
  Array.from(
    indexHtml.matchAll(/id="([^"]+)"/g),
    match => match[1]
  )
);

for (const match of script.matchAll(
  /getElementById\(\s*"([^"]+)"\s*\)/g
)) {
  assert.ok(
    htmlIds.has(match[1]),
    `JavaScriptが参照する#${match[1]}がHTMLにありません`
  );
}

assert.ok(
  indexHtml.indexOf('id="noteStage"') <
  indexHtml.indexOf('id="keyControl"'),
  "キーコントローラーが画像の後に配置されていません"
);

const style = readProjectFile("style.css");
const keyControlRule = style.match(
  /#keyControl\s*\{([\s\S]*?)\}/
);

assert.ok(keyControlRule, "キーコントローラーのCSSがありません");
assert.match(
  keyControlRule[1],
  /position:\s*static/,
  "キーコントローラーが通常レイアウトではありません"
);

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
assert.equal(manifest.start_url, "./", "PWAの開始URLがルートではありません");

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
assert.ok(precachePaths.includes("./"), "ルートHTMLが事前キャッシュされません");
assert.ok(
  !precachePaths.includes("./index.html"),
  "ルートHTMLを二重に事前キャッシュしています"
);
assert.ok(
  precachePaths.includes("./icons/favicon-48.png"),
  "faviconが事前キャッシュに含まれていません"
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

assert.match(
  serviceWorker,
  /CACHEABLE_URLS\.has\(\s*event\.request\.url\s*\)/,
  "動的キャッシュ対象が制限されていません"
);
assert.match(
  serviceWorker,
  /return caches\.open\(/,
  "動的キャッシュ保存の完了を待っていません"
);
assert.match(
  serviceWorker,
  /return cache\.put\(/,
  "cache.putの完了を待っていません"
);

console.log("Project checks passed.");
