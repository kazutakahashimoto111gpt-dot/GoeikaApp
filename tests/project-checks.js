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
  ).replace(/\r\n/g, "\n");
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
assert.match(
  script,
  /localStorage\.getItem\(\s*"goeikaapp:keyShift"\s*\)/,
  "main版専用のキー設定を読み込んでいません"
);
assert.match(
  script,
  /localStorage\.setItem\(\s*"goeikaapp:keyShift"\s*,/,
  "main版専用のキー設定に保存していません"
);
assert.match(
  script,
  /localStorage\.getItem\(\s*"kongoKeyShift"\s*\)/,
  "旧キー設定の移行がありません"
);
assert.doesNotMatch(
  script,
  /localStorage\.removeItem\(\s*"kongoKeyShift"\s*\)/,
  "他アプリが使う可能性のある旧キーを削除しています"
);
assert.match(script, /Number\(storedValue\)/);
assert.match(script, /Number\.isInteger\(parsedValue\)/);
assert.match(script, /Math\.max\(\s*-12,\s*Math\.min\(\s*12,/);

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

assert.match(
  indexHtml,
  /<button\s+id="updateNotice"\s+type="button"\s*>/,
  "更新通知が操作可能なボタンではありません"
);
assert.match(
  indexHtml,
  /waitingWorker\.postMessage\(\{\s*type: "SKIP_WAITING"\s*\}\)/,
  "更新通知からwaiting中のService Workerを有効化していません"
);
assert.match(
  indexHtml,
  /"controllerchange"[\s\S]*?window\.location\.reload\(\)/,
  "Service Workerの切替後に画面を再読み込みしていません"
);

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
assert.match(
  serviceWorker,
  /"message"[\s\S]*?"SKIP_WAITING"[\s\S]*?self\.skipWaiting\(\)/,
  "Service Workerが即時有効化メッセージを処理していません"
);
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

async function checkServiceWorkerIsolation() {
  const appRoot = "https://example.com/main/";
  const currentCache = "goeikaapp-main-v1.0.49";
  const cacheNames = new Set([
    "goeikaapp-v1.0.45",
    "goeikaapp-v1.0.46",
    "goeikaapp-main-v1.0.46",
    "goeikaapp-main-v1.0.47",
    "goeikaapp-main-v1.0.48",
    currentCache,
    "goeikaapp-hk-v4.0.4",
    "other-pwa-v1",
    "unrelated-cache",
    "goeikaapp-main-hk-v1.0.1",
    "goeikaapp-v1.0.45-extra"
  ]);
  const deleted = [];
  const opened = [];
  const fetched = [];
  const stored = [];
  const cachedResponses = new Map();
  const listeners = new Map();
  const cache = {
    addAll: async () => {},
    match: async request =>
      cachedResponses.get(typeof request === "string" ? request : request.url),
    put: async (request, response) => {
      stored.push(request.url);
      cachedResponses.set(request.url, response);
    }
  };
  const context = {
    URL,
    Set,
    Promise,
    console,
    self: {
      location: { href: `${appRoot}sw.js` },
      registration: { scope: appRoot },
      addEventListener: (type, listener) => listeners.set(type, listener)
    },
    caches: {
      keys: async () => [...cacheNames],
      delete: async name => {
        deleted.push(name);
        return cacheNames.delete(name);
      },
      open: async name => {
        opened.push(name);
        return cache;
      }
    },
    // 実ネットワークへ接続しない。許可済みURLの動作確認用モック。
    fetch: async request => {
      fetched.push(request.url);
      return { status: 200, clone() { return this; } };
    }
  };

  vm.createContext(context);
  new vm.Script(serviceWorker, { filename: "sw.js" }).runInContext(context);

  let reportedCache;
  listeners.get("message")({
    data: { type: "GET_CACHE_NAME" },
    ports: [{ postMessage: message => { reportedCache = message.cacheName; } }]
  });
  assert.equal(reportedCache, currentCache, "main版のキャッシュ名が更新されていません");

  let activation;
  listeners.get("activate")({ waitUntil: promise => { activation = promise; } });
  await activation;

  assert.deepEqual(
    deleted.sort(),
    [
      "goeikaapp-v1.0.45",
      "goeikaapp-v1.0.46",
      "goeikaapp-main-v1.0.46",
      "goeikaapp-main-v1.0.47",
      "goeikaapp-main-v1.0.48"
    ].sort(),
    "旧main版以外のキャッシュが削除されました"
  );
  for (const name of [
    currentCache,
    "goeikaapp-hk-v4.0.4",
    "other-pwa-v1",
    "unrelated-cache",
    "goeikaapp-main-hk-v1.0.1",
    "goeikaapp-v1.0.45-extra"
  ]) {
    assert.ok(cacheNames.has(name), `${name}が削除されました`);
  }

  async function dispatchFetch(url, mode = "same-origin", method = "GET") {
    let responsePromise;
    listeners.get("fetch")({
      request: { url, mode, method },
      respondWith: promise => { responsePromise = promise; }
    });
    if (responsePromise) await responsePromise;
    return Boolean(responsePromise);
  }

  const rootResponse = { fromCache: true };
  cachedResponses.set(appRoot, rootResponse);
  for (const url of [
    "https://example.com/other-pwa/",
    "https://example.com/other-pwa/style.css",
    "https://example.com/main-other/",
    "https://external.example/app/",
    `${appRoot}unknown.js`,
    `${appRoot}style.css?other=1`
  ]) {
    assert.equal(
      await dispatchFetch(url, "navigate"),
      false,
      `${url}にService Workerが介入しました`
    );
  }
  assert.equal(await dispatchFetch(`${appRoot}style.css`, "same-origin", "POST"), false);
  assert.equal(opened.length, 0, "許可リスト外の要求でキャッシュを開きました");
  assert.equal(fetched.length, 0, "許可リスト外の要求でfetchしました");
  assert.equal(stored.length, 0, "許可リスト外の要求を保存しました");

  assert.equal(await dispatchFetch(`${appRoot}?launch=1`, "navigate"), true);
  assert.equal(await dispatchFetch(`${appRoot}index.html`, "navigate"), true);
  assert.equal(fetched.length, 0, "main版のオフライン画面がキャッシュから返りません");
  assert.equal(await dispatchFetch(`${appRoot}style.css`), true);
  assert.deepEqual(fetched, [`${appRoot}style.css`]);
  assert.deepEqual(stored, [`${appRoot}style.css`]);
  assert.ok(opened.every(name => name === currentCache));
}

checkServiceWorkerIsolation()
  .then(() => console.log("Project checks passed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
