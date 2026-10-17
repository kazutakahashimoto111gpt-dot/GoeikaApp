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
  precachePaths.includes("./assets/icons/favicon-48.png"),
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

const appRoot = "https://example.com/GoeikaApp/";
const currentCache = "goeikaapp-main-v1.0.54";
const appOrigin = new URL(appRoot).origin;
const precacheUrls = precachePaths.map(file => new URL(file, appRoot).href);

// 保存リストの存在確認だけでは、依存ファイルの登録漏れを検出できない。
const requiredAssetUrls = new Set([
  appRoot,
  ...localAssetPaths.map(file => new URL(file, appRoot).href),
  ...manifest.icons.map(icon => new URL(icon.src, `${appRoot}manifest.json`).href),
  ...Array.from(
    style.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g),
    match => new URL(match[1], `${appRoot}style.css`).href
  )
].filter(url => new URL(url).origin === appOrigin));

for (const url of requiredAssetUrls) {
  assert.ok(precacheUrls.includes(url), `オフライン動作に必要な${url}が保存対象にありません`);
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function assertPending(promise, message) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  // 実時間の待機を入れず、保存を待つPromiseが先に完了していないか確認する。
  await new Promise(setImmediate);
  assert.equal(settled, false, message);
}

function createServiceWorkerEnvironment(options = {}) {
  const cacheNames = new Set([
    "goeikaapp-v1.0.45",
    "goeikaapp-v1.0.46",
    "goeikaapp-main-v1.0.46",
    "goeikaapp-main-v1.0.47",
    "goeikaapp-main-v1.0.48",
    "goeikaapp-main-v1.0.49",
    "goeikaapp-main-v1.0.50",
    currentCache,
    "goeikaapp-hk-v4.0.4",
    "other-pwa-v1",
    "unrelated-cache",
    "goeikaapp-main-hk-v1.0.1",
    "goeikaapp-v1.0.45-extra"
  ]);
  const listeners = new Map();
  const environment = {
    cacheNames,
    deleted: [],
    opened: [],
    fetched: [],
    stored: [],
    added: [],
    responses: new Map(),
    skipWaitingCalls: 0,
    networkResponse: new Response("network response"),
    networkError: null
  };
  const otherCaches = new Map();
  function makeCache(responses) {
    return {
      addAll: async files => {
        const urls = Array.from(files, file => new URL(file, appRoot).href);
        environment.added.push(urls);
        await options.addAllGate;
        for (const url of urls) responses.set(url, new Response(`cached: ${url}`));
      },
      match: async request =>
        responses.get(typeof request === "string" ? request : request.url),
      put: async (request, response) => {
        environment.stored.push(request.url);
        assert.ok(response instanceof Response, "保存対象がResponseではありません");
        await options.putGate;
        responses.set(request.url, response);
      }
    };
  }
  const cache = makeCache(environment.responses);
  const context = {
    URL,
    Set,
    Promise,
    console,
    self: {
      location: { href: `${appRoot}sw.js`, origin: appOrigin },
      registration: { scope: appRoot },
      addEventListener: (type, listener) => listeners.set(type, listener),
      skipWaiting: () => { environment.skipWaitingCalls++; }
    },
    caches: {
      keys: async () => [...cacheNames],
      delete: async name => {
        environment.deleted.push(name);
        return cacheNames.delete(name);
      },
      open: async name => {
        environment.opened.push(name);
        if (name === currentCache) return cache;
        if (!otherCaches.has(name)) otherCaches.set(name, makeCache(new Map()));
        return otherCaches.get(name);
      }
    },
    // 実ネットワークへ接続しない。許可済みURLの動作確認用モック。
    fetch: async request => {
      environment.fetched.push(request.url);
      if (environment.networkError) throw environment.networkError;
      return environment.networkResponse;
    }
  };

  vm.createContext(context);
  new vm.Script(serviceWorker, { filename: "sw.js" }).runInContext(context);

  environment.message = (type, origin = appOrigin) => {
    const replies = [];
    listeners.get("message")({
      origin,
      data: { type },
      ports: [{ postMessage: message => replies.push(message) }]
    });
    return replies;
  };
  environment.lifecycle = type => {
    const promises = [];
    assert.ok(listeners.has(type), `${type}イベントが登録されていません`);
    listeners.get(type)({ waitUntil: promise => promises.push(promise) });
    assert.ok(promises.length > 0, `${type}がwaitUntilで完了を待っていません`);
    return Promise.all(promises);
  };
  environment.fetch = async (url, mode = "same-origin", method = "GET") => {
    let responsePromise;
    let handled = false;
    listeners.get("fetch")({
      request: { url, mode, method },
      respondWith: promise => {
        assert.equal(handled, false, "respondWithが重複しています");
        handled = true;
        responsePromise = promise;
      }
    });
    if (!handled) return { handled: false };
    const response = await responsePromise;
    assert.ok(response instanceof Response, `${url}に有効なResponseが返りません`);
    return { handled: true, response };
  };
  return environment;
}

async function checkServiceWorker() {
  const environment = createServiceWorkerEnvironment();
  for (const origin of ["https://external.example", "", "null"]) {
    assert.equal(environment.message("GET_CACHE_NAME", origin).length, 0, "異なるオリジンに応答しました");
    environment.message("SKIP_WAITING", origin);
  }
  assert.equal(environment.skipWaitingCalls, 0, "異なるオリジンから更新を開始しました");
  const replies = environment.message("GET_CACHE_NAME");
  assert.equal(replies.length, 1, "同一オリジンのキャッシュ名取得に応答しません");
  assert.equal(replies[0].cacheName, currentCache, "現在のキャッシュ名が一致しません");
  environment.message("SKIP_WAITING");
  assert.equal(environment.skipWaitingCalls, 1, "同一オリジンから更新を開始できません");
  environment.message("UNKNOWN");
  assert.equal(environment.skipWaitingCalls, 1, "不明なメッセージで更新を開始しました");

  const saving = createDeferred();
  const installing = createServiceWorkerEnvironment({ addAllGate: saving.promise });
  const installation = installing.lifecycle("install");
  await assertPending(installation, "事前キャッシュの保存完了を待っていません");
  assert.deepEqual(installing.opened, [currentCache]);
  assert.deepEqual(installing.added, [precacheUrls], "事前キャッシュの保存内容が一致しません");
  saving.resolve();
  await installation;
  for (const url of requiredAssetUrls) {
    assert.ok(installing.responses.has(url), `${url}がインストール時に保存されません`);
  }
  const failingSave = createDeferred();
  const failingInstall = createServiceWorkerEnvironment({ addAllGate: failingSave.promise });
  const failedInstallation = failingInstall.lifecycle("install");
  const installRejected = assert.rejects(failedInstallation, /保存失敗/);
  failingSave.reject(new Error("保存失敗"));
  await installRejected;

  await environment.lifecycle("activate");

  assert.deepEqual(
    environment.deleted.sort(),
    [
      "goeikaapp-v1.0.45",
      "goeikaapp-v1.0.46",
      "goeikaapp-main-v1.0.46",
      "goeikaapp-main-v1.0.47",
      "goeikaapp-main-v1.0.48",
      "goeikaapp-main-v1.0.49",
      "goeikaapp-main-v1.0.50"
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
    assert.ok(environment.cacheNames.has(name), `${name}が削除されました`);
  }

  const rootResponse = new Response("offline app HTML");
  environment.responses.set(appRoot, rootResponse);
  for (const url of [
    "https://example.com/other-pwa/",
    "https://example.com/other-pwa/style.css",
    "https://example.com/GoeikaApp-other/",
    "https://external.example/app/",
    `${appRoot}unknown.js`,
    `${appRoot}style.css?other=1`
  ]) {
    assert.equal(
      (await environment.fetch(url, "navigate")).handled,
      false,
      `${url}にService Workerが介入しました`
    );
  }
  assert.equal((await environment.fetch(`${appRoot}style.css`, "same-origin", "POST")).handled, false);
  assert.equal(environment.opened.length, 0, "許可リスト外の要求でキャッシュを開きました");
  assert.equal(environment.fetched.length, 0, "許可リスト外の要求でfetchしました");
  assert.equal(environment.stored.length, 0, "許可リスト外の要求を保存しました");

  environment.networkError = new Error("offline");
  for (const url of [appRoot, `${appRoot}?launch=1`, `${appRoot}index.html`]) {
    const result = await environment.fetch(url, "navigate");
    assert.strictEqual(result.response, rootResponse, "保存済みHTMLが返りません");
    assert.equal(await result.response.clone().text(), "offline app HTML");
  }
  assert.equal(environment.fetched.length, 0, "オフライン画面の取得で通信しました");
  await assert.rejects(environment.fetch(`${appRoot}style.css`), /offline/);
  assert.equal(environment.stored.length, 0, "通信失敗時に保存しました");

  const writing = createDeferred();
  const fetching = createServiceWorkerEnvironment({ putGate: writing.promise });
  const download = fetching.fetch(`${appRoot}style.css`);
  await assertPending(download, "動的キャッシュの保存完了を待っていません");
  assert.deepEqual(fetching.stored, [`${appRoot}style.css`]);
  writing.resolve();
  const downloaded = await download;
  assert.strictEqual(downloaded.response, fetching.networkResponse, "ネットワークの応答が返りません");
  const savedResponse = fetching.responses.get(`${appRoot}style.css`);
  assert.notStrictEqual(savedResponse, downloaded.response, "応答を複製せず保存しています");
  assert.equal(await savedResponse.clone().text(), "network response");
  assert.equal(await downloaded.response.text(), "network response");
  fetching.networkError = new Error("offline");
  assert.strictEqual((await fetching.fetch(`${appRoot}style.css`)).response, savedResponse);
  assert.deepEqual(fetching.fetched, [`${appRoot}style.css`], "保存済みファイルの取得で通信しました");
  assert.ok(fetching.opened.every(name => name === currentCache));

  const errorResponse = createServiceWorkerEnvironment();
  errorResponse.networkResponse = new Response("not found", { status: 404 });
  assert.strictEqual((await errorResponse.fetch(`${appRoot}style.css`)).response, errorResponse.networkResponse);
  assert.equal(errorResponse.stored.length, 0, "エラー応答をキャッシュしました");
}

// ブラウザや音声デバイスを起動せず、登録されたイベントから本体を実行する。
function createAppEnvironment(options = {}) {
  class MockEventTarget {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    async dispatch(type, values = {}) {
      const event = {
        target: this,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
        ...values
      };
      for (const listener of this.listeners.get(type) || []) await listener(event);
      return event;
    }
  }
  class MockElement extends MockEventTarget {
    constructor() {
      super();
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.textContent = "";
      this.offsetWidth = 1000;
      this.offsetHeight = 1000;
      this.style = { setProperty(name, value) { this[name] = value; } };
    }
    appendChild(element) {
      element.parentElement = this;
      this.children.push(element);
      return element;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.offsetWidth, height: this.offsetHeight };
    }
    getAnimations() { return []; }
    animate() { return { cancel() {} }; }
    setPointerCapture() {}
    get textContent() { return this.text; }
    set textContent(value) { this.text = String(value); }
  }

  const body = new MockElement();
  const elements = new Map(Array.from(htmlIds, id => [id, body.appendChild(new MockElement())]));
  const document = new MockEventTarget();
  Object.assign(document, {
    body,
    documentElement: new MockElement(),
    visibilityState: "visible",
    hidden: false,
    getElementById: id => elements.get(id) || null,
    createElement: () => new MockElement()
  });
  const storage = new Map(Object.entries(options.storage || {}));
  const storageWrites = [];
  const storageRemovals = [];
  const warnings = [];
  const audioContexts = [];
  const scheduled = new Map();
  let nextTimer = 0;
  const schedule = callback => {
    const id = ++nextTimer;
    scheduled.set(id, callback);
    return id;
  };
  function createAudioParam() {
    return {
      value: 0,
      events: [],
      setValueAtTime(...args) { this.events.push(["set", ...args]); },
      exponentialRampToValueAtTime(...args) { this.events.push(["ramp", ...args]); },
      cancelScheduledValues(...args) { this.events.push(["cancel", ...args]); },
      setTargetAtTime(...args) { this.events.push(["target", ...args]); }
    };
  }
  class MockAudioContext {
    constructor() {
      this.state = "suspended";
      this.currentTime = 1;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.resumeCalls = 0;
      audioContexts.push(this);
    }
    async resume() {
      this.resumeCalls++;
      if (options.resumeError) throw options.resumeError;
      await options.resumeGate;
      this.state = "running";
    }
    async close() { this.state = "closed"; }
    createGain() {
      const gain = {
        gain: createAudioParam(),
        connections: [],
        connect(target) { this.connections.push(target); return target; }
      };
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      const audio = this;
      const oscillator = {
        frequency: createAudioParam(),
        started: [],
        stopped: [],
        connections: [],
        connect(target) { this.connections.push(target); return target; },
        start(time) {
          assert.equal(audio.state, "running", "音声の準備完了前に発音しました");
          this.started.push(time);
        },
        stop(time) {
          assert.equal(this.started.length, 1, "未開始または重複開始した音を停止しました");
          this.stopped.push(time);
        }
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }
  }
  const window = new MockEventTarget();
  Object.assign(window, {
    AudioContext: MockAudioContext,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1000,
    innerHeight: 1000,
    scrollY: 0,
    setTimeout: schedule,
    clearTimeout: id => scheduled.delete(id)
  });
  const context = vm.createContext({
    window,
    document,
    navigator: {},
    HTMLElement: MockElement,
    console: { warn: (...args) => warnings.push(args) },
    requestAnimationFrame: schedule,
    setTimeout: schedule,
    clearTimeout: id => scheduled.delete(id),
    localStorage: {
      getItem(key) {
        if (options.storageReadError) throw new Error("読み込み拒否");
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (options.storageWriteError) throw new Error("保存拒否");
        storageWrites.push([key, String(value)]);
        storage.set(key, String(value));
      },
      removeItem(key) { storageRemovals.push(key); storage.delete(key); },
      clear() { assert.fail("LocalStorage全体を削除しました"); }
    }
  });
  new vm.Script(readProjectFile("notes.js"), { filename: "notes.js" }).runInContext(context);
  new vm.Script(script, { filename: "script.js" }).runInContext(context);
  return { window, document, elements, storage, storageWrites, storageRemovals, warnings, audioContexts };
}

function pointerAt(note, pointerId = 1) {
  return { pointerId, clientX: note.xRatio * 1000, clientY: note.yRatio * 1000 };
}

function assertSoundStopped(environment, message) {
  const oscillators = environment.audioContexts.flatMap(audio => audio.oscillators);
  assert.ok(oscillators.length > 0, "停止確認の前に音が開始されていません");
  for (const oscillator of oscillators) assert.equal(oscillator.stopped.length, 1, message);
  assert.equal(environment.elements.get("notePressMarker").className, "", "押下表示が残っています");
}

async function checkAppRuntime() {
  for (const [value, expected] of [
    [undefined, "±0"], ["3", "+3"], ["-5", "-5"],
    ["999", "+12"], ["-999", "-12"], ["invalid", "±0"], ["1.5", "±0"]
  ]) {
    const environment = createAppEnvironment({
      storage: value === undefined ? {} : { "goeikaapp:keyShift": value }
    });
    assert.equal(environment.elements.get("keyDisplay").textContent, expected, `キー設定${value}を正しく復元しません`);
    assert.equal(environment.audioContexts.length, 0, "利用者の操作前に音声を開始しました");
  }
  const environment = createAppEnvironment({
    storage: { kongoKeyShift: "4", "other-pwa:keyShift": "9" }
  });
  assert.equal(environment.elements.get("keyDisplay").textContent, "+4");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "4", "旧設定が移行されません");
  await environment.elements.get("keyUp").dispatch("click");
  assert.equal(environment.elements.get("keyDisplay").textContent, "+5");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "5");
  await environment.elements.get("keyDown").dispatch("click");
  assert.equal(environment.elements.get("keyDisplay").textContent, "+4");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "4");
  await environment.elements.get("keyDisplay").dispatch("click");
  assert.equal(environment.elements.get("keyDisplay").textContent, "±0");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "0");
  for (let count = 0; count < 14; count++) await environment.elements.get("keyUp").dispatch("click");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "12", "キーの上限を超えました");
  for (let count = 0; count < 26; count++) await environment.elements.get("keyDown").dispatch("click");
  assert.equal(environment.storage.get("goeikaapp:keyShift"), "-12", "キーの下限を超えました");
  assert.equal(environment.storage.get("kongoKeyShift"), "4", "旧設定を変更しました");
  assert.equal(environment.storage.get("other-pwa:keyShift"), "9", "別アプリの設定を変更しました");
  assert.ok(environment.storageWrites.every(([key]) => key === "goeikaapp:keyShift"));
  assert.deepEqual(environment.storageRemovals, []);
  assert.equal(environment.warnings.length, 0);

  const unavailable = createAppEnvironment({ storageReadError: true, storageWriteError: true });
  assert.equal(unavailable.elements.get("keyDisplay").textContent, "±0");
  await unavailable.elements.get("keyUp").dispatch("click");
  assert.equal(unavailable.elements.get("keyDisplay").textContent, "+1", "保存できないと操作も失敗します");

  const playing = createAppEnvironment({ storage: { "goeikaapp:keyShift": "12" } });
  const image = playing.elements.get("noteImage");
  const firstPointer = pointerAt(notes[12]);
  await image.dispatch("pointerdown", firstPointer);
  assert.equal(playing.audioContexts.length, 1);
  const audio = playing.audioContexts[0];
  assert.equal(audio.resumeCalls, 1, "停止中のAudioContextを再開していません");
  assert.equal(audio.oscillators.length, 4, "押下で音が開始されません");
  assert.deepEqual(audio.oscillators.map(oscillator => oscillator.frequency.value), [880, 1760, 2640, 3520]);
  assert.ok(audio.oscillators.every(oscillator => oscillator.started.length === 1));
  assert.ok(audio.gains.some(gain => gain.connections.includes(audio.destination)), "出力先に接続されていません");
  assert.match(playing.elements.get("notePressMarker").className, /is-visible/);
  await image.dispatch("pointermove", firstPointer);
  assert.equal(audio.oscillators.length, 4, "同じ音符への移動で再発音しました");
  await image.dispatch("pointermove", pointerAt(notes[0], 2));
  await image.dispatch("pointerup", { pointerId: 2 });
  assert.equal(audio.oscillators.length, 4, "別の指が演奏を変更しました");
  assert.equal(audio.oscillators[0].stopped.length, 0, "別の指で演奏が停止しました");
  await image.dispatch("pointermove", pointerAt(notes[0]));
  assert.equal(audio.oscillators.length, 8, "移動先の音が開始されません");
  assert.equal(audio.oscillators[4].frequency.value, 440);
  await image.dispatch("pointerup", firstPointer);
  assertSoundStopped(playing, "指を離しても音が停止しません");
  assert.equal(playing.warnings.length, 0);

  for (const [target, type] of [
    ["image", "pointercancel"], ["image", "lostpointercapture"],
    ["window", "pointerup"], ["window", "pointercancel"], ["window", "blur"]
  ]) {
    const ending = createAppEnvironment();
    const noteImage = ending.elements.get("noteImage");
    await noteImage.dispatch("pointerdown", pointerAt(notes[12]));
    await (target === "image" ? noteImage : ending.window).dispatch(type, { pointerId: 1 });
    assertSoundStopped(ending, `${target}の${type}で音が停止しません`);
  }

  const background = createAppEnvironment();
  await background.elements.get("noteImage").dispatch("pointerdown", firstPointer);
  background.document.hidden = true;
  background.document.visibilityState = "hidden";
  await background.document.dispatch("visibilitychange");
  assertSoundStopped(background, "バックグラウンド移行で音が停止しません");
  assert.equal(background.audioContexts[0].state, "closed");
  background.document.hidden = false;
  background.document.visibilityState = "visible";
  await background.document.dispatch("visibilitychange");
  await background.elements.get("noteImage").dispatch("pointerdown", firstPointer);
  assert.equal(background.audioContexts.length, 2, "復帰後に音声を準備し直していません");
  assert.equal(background.audioContexts[1].oscillators.length, 4, "復帰後に発音できません");
  await background.elements.get("noteImage").dispatch("pointerup", firstPointer);
  assertSoundStopped(background, "復帰後の音が停止しません");

  const resuming = createDeferred();
  const pending = createAppEnvironment({ resumeGate: resuming.promise });
  const pendingImage = pending.elements.get("noteImage");
  const starting = pendingImage.dispatch("pointerdown", firstPointer);
  await pendingImage.dispatch("pointerup", firstPointer);
  resuming.resolve();
  await starting;
  assert.equal(pending.audioContexts[0].oscillators.length, 0, "指を離した後で発音しました");
  await pendingImage.dispatch("pointerdown", firstPointer);
  assert.equal(pending.audioContexts[0].oscillators.length, 4, "初期化中の中断後に再演奏できません");
  await pendingImage.dispatch("pointerup", firstPointer);
  assertSoundStopped(pending, "中断後の演奏が停止しません");

  const failedAudio = createAppEnvironment({ resumeError: new Error("音声再開失敗") });
  await failedAudio.elements.get("noteImage").dispatch("pointerdown", firstPointer);
  assert.equal(failedAudio.audioContexts[0].oscillators.length, 0, "初期化失敗時に発音しました");
  assert.equal(failedAudio.elements.get("notePressMarker").className, "");
  assert.equal(failedAudio.warnings.length, 1, "音声初期化失敗が報告されません");
}

async function runChecks() {
  await checkServiceWorker();
  await checkAppRuntime();
}

runChecks()
  .then(() => console.log("Project checks passed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
