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
  "microphone.js",
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

assert.ok(indexHtml.indexOf('src="notes.js"') < indexHtml.indexOf('src="microphone.js"'));
assert.ok(indexHtml.indexOf('src="microphone.js"') < indexHtml.indexOf('src="script.js"'), "マイク処理を本体より先に読み込んでいません");

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
const currentCache = "goeikaapp-main-v1.1.0";
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
    "goeikaapp-main-v1.0.55",
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
  installing.networkError = new Error("offline");
  for (const url of [appRoot, `${appRoot}notes.js`, `${appRoot}microphone.js`, `${appRoot}script.js`]) {
    assert.equal((await installing.fetch(url)).response, installing.responses.get(url), "オフラインで必要なファイルを取得できません");
  }
  assert.equal(installing.fetched.length, 0, "保存済みの調律機能の取得で通信しました");
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
      "goeikaapp-main-v1.0.50",
      "goeikaapp-main-v1.0.55"
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
  const resizeObservers = [];
  const scheduled = new Map();
  const frames = new Map();
  const streams = [];
  const microphoneRequests = [];
  const input = {
    frequency: 0, amplitude: 0.15, harmonics: [1], noise: 0, dc: 0,
    modulationDepth: 0, modulationDivisor: 2
  };
  let elapsed = 0;
  let sampleOffset = 0;
  let noiseSeed = 17;
  let nextTimer = 0;
  const schedule = callback => {
    const id = ++nextTimer;
    scheduled.set(id, callback);
    return id;
  };
  const scheduleFrame = callback => {
    const id = ++nextTimer;
    frames.set(id, callback);
    return id;
  };
  function createStream() {
    const track = new MockEventTarget();
    Object.assign(track, {
      readyState: "live",
      muted: false,
      stopCalls: 0,
      stop() { this.stopCalls++; this.readyState = "ended"; }
    });
    const stream = { track, getTracks: () => [track], getAudioTracks: () => [track] };
    streams.push(stream);
    return stream;
  }
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
      this.sampleRate = options.sampleRate || 48000;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.sources = [];
      this.analysers = [];
      this.resumeCalls = 0;
      audioContexts.push(this);
    }
    async resume() {
      this.resumeCalls++;
      if (options.resumeError) throw options.resumeError;
      await options.resumeGate;
      if (this.state === "closed") throw new Error("終了済みです");
      this.state = "running";
    }
    async close() { this.state = "closed"; }
    createMediaStreamSource(stream) {
      const source = {
        stream,
        connections: [],
        connect(target) { this.connections.push(target); return target; },
        disconnect() { this.disconnected = true; }
      };
      this.sources.push(source);
      return source;
    }
    createAnalyser() {
      const rate = this.sampleRate;
      const analyser = {
        fftSize: 0,
        disconnect() { this.disconnected = true; },
        getFloatTimeDomainData(buffer) {
          for (let index = 0; index < buffer.length; index++) {
            const phase = 2 * Math.PI * input.frequency * (index + sampleOffset) / rate;
            const tone = input.frequency ? input.harmonics.reduce((sum, amplitude, harmonic) =>
              sum + amplitude * Math.sin(phase * (harmonic + 1)), 0) * input.amplitude : 0;
            const envelope = 1 + input.modulationDepth * Math.sin(phase / input.modulationDivisor);
            noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
            buffer[index] = tone * envelope + input.noise * (noiseSeed / 0xffffffff * 2 - 1) + input.dc;
          }
          sampleOffset += buffer.length;
        }
      };
      this.analysers.push(analyser);
      return analyser;
    }
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
    isSecureContext: options.secureContext !== false,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1000,
    innerHeight: 1000,
    scrollY: 0,
    setTimeout: schedule,
    clearTimeout: id => scheduled.delete(id)
  });
  if (options.audioUnsupported) window.AudioContext = undefined;
  if (options.resizeObserver) {
    window.ResizeObserver = class {
      constructor(callback) { this.callback = callback; resizeObservers.push(this); }
      observe(target) { this.target = target; }
    };
  }
  const navigator = {
    audioSession: { type: "auto" },
    mediaDevices: options.microphoneUnsupported ? undefined : {
      getSupportedConstraints: () => ({ autoGainControl: true, noiseSuppression: true, echoCancellation: true, channelCount: true }),
      async getUserMedia(constraints) {
        microphoneRequests.push(constraints);
        if (options.microphoneError) throw options.microphoneError;
        if (options.getUserMedia) return options.getUserMedia();
        if (options.microphoneGate) return options.microphoneGate;
        return createStream();
      }
    }
  };
  const context = vm.createContext({
    window,
    document,
    navigator,
    HTMLElement: MockElement,
    console: { warn: (...args) => warnings.push(args) },
    requestAnimationFrame: scheduleFrame,
    cancelAnimationFrame: id => frames.delete(id),
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
  new vm.Script(readProjectFile("microphone.js"), { filename: "microphone.js" }).runInContext(context);
  new vm.Script(script, { filename: "script.js" }).runInContext(context);
  return {
    window, document, navigator, elements, storage, storageWrites, storageRemovals, warnings, audioContexts,
    input, streams, microphoneRequests, createStream, resizeObservers,
    advance(milliseconds, step = 40) {
      const end = elapsed + milliseconds;
      while (elapsed < end) {
        elapsed = Math.min(end, elapsed + step);
        const pending = Array.from(frames.values());
        frames.clear();
        for (const callback of pending) callback(elapsed);
      }
    }
  };
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

  for (const action of ["pointerup", "mode", "hidden", "pagehide"]) {
    const resuming = createDeferred();
    const pending = createAppEnvironment({ resumeGate: resuming.promise });
    const pendingImage = pending.elements.get("noteImage");
    const starting = pendingImage.dispatch("pointerdown", firstPointer);
    if (action === "pointerup") await pendingImage.dispatch("pointerup", firstPointer);
    if (action === "mode") await pending.elements.get("tuningMode").dispatch("click");
    if (action === "hidden") {
      pending.document.hidden = true;
      pending.document.visibilityState = "hidden";
      await pending.document.dispatch("visibilitychange");
    }
    if (action === "pagehide") await pending.window.dispatch("pagehide");
    resuming.resolve();
    await starting;
    assert.equal(pending.audioContexts[0].oscillators.length, 0, "取り消した操作で後から発音しました");
    assert.equal(pending.warnings.length, 0, "取り消した初期化を音声エラーとして報告しました");
    pending.document.hidden = false;
    pending.document.visibilityState = "visible";
    await pending.document.dispatch("visibilitychange");
    if (action === "mode") await pending.elements.get("performanceMode").dispatch("click");
    await pendingImage.dispatch("pointerdown", firstPointer);
    assert.equal(pending.audioContexts.at(-1).oscillators.length, 4, "初期化中の中断後に再演奏できません");
    await pendingImage.dispatch("pointerup", firstPointer);
    assertSoundStopped(pending, "中断後の演奏が停止しません");
  }

  const failedAudio = createAppEnvironment({ resumeError: new Error("音声再開失敗") });
  await failedAudio.elements.get("noteImage").dispatch("pointerdown", firstPointer);
  assert.equal(failedAudio.audioContexts[0].oscillators.length, 0, "初期化失敗時に発音しました");
  assert.equal(failedAudio.elements.get("notePressMarker").className, "");
  assert.equal(failedAudio.warnings.length, 1, "音声初期化失敗が報告されません");
}

async function runChecks() {
  await checkServiceWorker();
  await checkAppRuntime();
  await checkTuningRuntime();
}

async function checkTuningRuntime() {
  const element = (environment, id) => environment.elements.get(id);
  const click = (environment, id) => element(environment, id).dispatch("click");
  function assertOctave(environment, expected) {
    for (const [shift, id] of [["-1", "tuningOctaveDown"], ["0", "tuningOctaveNone"], ["1", "tuningOctaveUp"]]) {
      assert.equal(element(environment, id).getAttribute("aria-pressed"), String(shift === expected), `表示補正${expected}の選択表示が不正です`);
    }
  }
  const isLit = environment => /is-visible/.test(element(environment, "notePressMarker").className);
  function assertNote(environment, note) {
    assert.ok(isLit(environment), `${note.name}が点灯しません`);
    assert.equal(element(environment, "notePressMarker").style.left, `${note.xRatio * 1000}px`, "異なる音符が点灯しました");
    assert.equal(element(environment, "notePressMarker").style.top, `${note.yRatio * 1000}px`, "異なる音符が点灯しました");
  }
  async function startTuning(options = {}) {
    const environment = createAppEnvironment(options);
    await click(environment, "tuningMode");
    assert.equal(environment.microphoneRequests.length, 0, "切替だけでマイクを要求しました");
    await click(environment, "microphoneToggle");
    assert.match(element(environment, "microphoneStatus").textContent, /歌わず/);
    assert.equal(element(environment, "microphoneStatus").hidden, false, "周囲音の測定案内が隠れています");
    environment.advance(1320);
    assert.equal(element(environment, "microphoneLevelState").textContent, "入力中");
    assert.equal(element(environment, "microphoneStatus").hidden, true, "通常入力中に重複する案内が表示されています");
    return environment;
  }
  function assertReleased(environment) {
    assert.ok(environment.streams.every(stream => stream.track.readyState === "ended"), "入力トラックが残っています");
    assert.ok(environment.audioContexts.every(audio => audio.state === "closed"), "AudioContextが残っています");
    assert.ok(environment.audioContexts.flatMap(audio => audio.sources).every(source => source.disconnected), "入力接続が残っています");
    assert.equal(isLit(environment), false, "点灯が残っています");
    assert.equal(element(environment, "microphoneLevel").value, 0, "入力レベルの測定値が残っています");
    assert.equal(element(environment, "microphoneLevelState").textContent, "停止中");
    const corrected = element(environment, "tuningOctaveNone").getAttribute("aria-pressed") === "true" ? "" : " ／ 補正後：—";
    assert.equal(element(environment, "microphonePitch").textContent, `検出：—${corrected} ／ 点灯基準：—`, "停止後に検出音が残っています");
  }

  for (const mode of ["tuning", "performance", "invalid", "", undefined]) {
    const environment = createAppEnvironment({ storage: { "goeikaapp:mode": mode } });
    assert.equal(element(environment, "microphonePanel").hidden, mode !== "tuning");
    assert.equal(element(environment, "tuningMode").getAttribute("aria-pressed"), String(mode === "tuning"));
    assert.equal(element(environment, "microphoneLevelState").textContent, "停止中");
    assert.equal(environment.microphoneRequests.length, 0, "モード復元時にマイクを要求しました");
    assert.equal(environment.audioContexts.length, 0);
  }
  for (const [value, expected] of [
    [undefined, 5], ["0", 5], ["11", 5], ["100", 5], ["73", 5], ["50", 5], ["44", 5],
    ["", 5], ["invalid", 5], ["-1", 5], ["101", 5], ["2.5", 5]
  ]) {
    const environment = createAppEnvironment({ storage: { "goeikaapp:micSensitivity": value } });
    assert.equal(Number(element(environment, "microphoneSensitivity").value), expected, `感度${value}の復元が不正です`);
  }
  for (let level = 1; level <= 10; level++) {
    const environment = createAppEnvironment({ storage: { "goeikaapp:micSensitivity": String(level) } });
    assert.equal(Number(element(environment, "microphoneSensitivity").value), level, `新形式の感度${level}を復元できません`);
    element(environment, "microphoneSensitivity").value = String(level);
    await element(environment, "microphoneSensitivity").dispatch("input");
    assert.equal(element(environment, "microphoneSensitivityValue").textContent, String(level));
    assert.equal(environment.storage.get("goeikaapp:micSensitivity"), String(level), "感度を1〜10で保存していません");
    const restored = createAppEnvironment({ storage: Object.fromEntries(environment.storage) });
    assert.equal(Number(element(restored, "microphoneSensitivity").value), level, `感度${level}を復元できません`);
    assert.equal(restored.microphoneRequests.length, 0, "感度の復元でマイクを開始しました");
    for (const value of ["0", "11", "2.5", "invalid", ""]) {
      const previousWrites = environment.storageWrites.length;
      element(environment, "microphoneSensitivity").value = value;
      await element(environment, "microphoneSensitivity").dispatch("input");
      assert.equal(Number(element(environment, "microphoneSensitivity").value), level, "不正な感度を採用しました");
      assert.equal(environment.storageWrites.length, previousWrites, "不正な感度を保存しました");
    }
  }
  for (const [value, expected] of [
    [undefined, "0"], ["-1", "-1"], ["0", "0"], ["1", "1"], ["", "0"],
    ["invalid", "0"], ["-2", "0"], ["2", "0"], ["0.5", "0"], ["12", "0"], ["1.0", "0"]
  ]) {
    const environment = createAppEnvironment({ storage: {
      "goeikaapp:mode": "tuning", "goeikaapp:tuningOctaveShift": value
    } });
    assertOctave(environment, expected);
    assert.equal(environment.microphoneRequests.length, 0, "補正の復元時にマイクを要求しました");
    assert.equal(environment.audioContexts.length, 0);
    assertReleased(environment);
  }
  const settings = createAppEnvironment({ storage: {
    "goeikaapp:keyShift": "3", kongoKeyShift: "2", mode: "other", micSensitivity: "other",
    tuningOctaveShift: "other", "other-pwa:tuningOctaveShift": "-1",
    "other-pwa:mode": "other", "other-pwa:micSensitivity": "17"
  } });
  await click(settings, "tuningMode");
  element(settings, "microphoneSensitivity").value = "9";
  await element(settings, "microphoneSensitivity").dispatch("input");
  await click(settings, "tuningOctaveUp");
  assert.equal(settings.storage.get("goeikaapp:mode"), "tuning");
  assert.equal(settings.storage.get("goeikaapp:micSensitivity"), "9");
  assert.equal(settings.storage.get("goeikaapp:tuningOctaveShift"), "1");
  assert.equal(settings.storage.get("other-pwa:tuningOctaveShift"), "-1");
  assert.equal(settings.storage.get("tuningOctaveShift"), "other");
  assert.equal(settings.storage.get("goeikaapp:keyShift"), "3");
  assert.equal(settings.storage.get("kongoKeyShift"), "2");
  assert.equal(settings.storage.get("other-pwa:mode"), "other");
  assert.equal(settings.storage.get("other-pwa:micSensitivity"), "17");
  assert.equal(settings.storage.get("mode"), "other");
  assert.equal(settings.storage.get("micSensitivity"), "other");
  assert.ok(settings.storageWrites.every(([key]) => ["goeikaapp:mode", "goeikaapp:micSensitivity", "goeikaapp:tuningOctaveShift"].includes(key)));
  assert.deepEqual(settings.storageRemovals, []);
  const restored = createAppEnvironment({ storage: Object.fromEntries(settings.storage) });
  assert.equal(element(restored, "microphonePanel").hidden, false);
  assert.equal(Number(element(restored, "microphoneSensitivity").value), 9);
  assertOctave(restored, "1");
  assert.equal(restored.microphoneRequests.length, 0);
  assertReleased(restored);

  const unavailable = createAppEnvironment({ storageReadError: true, storageWriteError: true });
  assert.equal(Number(element(unavailable, "microphoneSensitivity").value), 5, "保存値を読めない場合に初期感度を使っていません");
  assertOctave(unavailable, "0");
  await click(unavailable, "tuningMode");
  element(unavailable, "microphoneSensitivity").value = "9";
  await element(unavailable, "microphoneSensitivity").dispatch("input");
  assert.equal(element(unavailable, "microphoneSensitivityValue").textContent, "9");
  assert.equal(element(unavailable, "microphonePanel").hidden, false);
  await click(unavailable, "tuningOctaveUp");
  assertOctave(unavailable, "1");
  await click(unavailable, "microphoneToggle");
  unavailable.advance(1320);
  unavailable.input.frequency = 220;
  unavailable.advance(240);
  assertNote(unavailable, notes[12]);
  await click(unavailable, "microphoneToggle");
  assertReleased(unavailable);

  // キーと点灯補正の両端でも、全音符を判定できることを確認する。
  for (const sampleRate of [44100, 48000]) {
    for (const shift of [-12, 2, 12]) {
      for (const octave of [-1, 1]) {
        const environment = await startTuning({ sampleRate, storage: {
          "goeikaapp:keyShift": String(shift), "goeikaapp:tuningOctaveShift": String(octave)
        } });
        for (const note of notes) {
          environment.input.frequency = note.frequency * 2 ** (shift / 12 - octave);
          environment.advance(280);
          assertNote(environment, note);
        }
        for (const [note, cents] of [[notes[0], -49], [notes.at(-1), 49]]) {
          environment.input.frequency = note.frequency * 2 ** (shift / 12 - octave + cents / 1200);
          environment.advance(280);
          assertNote(environment, note);
        }
        for (const frequency of [
          notes[0].frequency * 2 ** ((shift - 1) / 12),
          notes.at(-1).frequency * 2 ** ((shift + 1) / 12)
        ]) {
          environment.input.frequency = frequency * 2 ** -octave;
          environment.advance(280);
          assert.equal(isLit(environment), false, "補正後の音域外を別の音符へ丸めました");
        }
        await click(environment, "microphoneToggle");
        assertReleased(environment);
      }
    }
  }

  const correction = await startTuning({ storage: { "goeikaapp:keyShift": "2" } });
  correction.input.frequency = notes[12].frequency * 2 ** (2 / 12 - 1);
  correction.advance(240);
  assertNote(correction, notes[0]);
  await click(correction, "tuningOctaveUp");
  assert.equal(isLit(correction), false, "補正変更時に古い点灯が残っています");
  assert.equal(element(correction, "microphonePitch").textContent, "検出：— ／ 補正後：— ／ 点灯基準：—");
  correction.advance(40);
  assert.equal(isLit(correction), false, "補正変更後に安定待ちを省略しました");
  correction.advance(40);
  assertNote(correction, notes[12]);
  const pitchDescription = element(correction, "microphonePitch").textContent.match(/^検出：(\d+\.\d) Hz ／ 補正後：(\d+\.\d) Hz ／ 点灯基準：五 493\.9 Hz$/);
  assert.ok(pitchDescription, "検出値・補正後・点灯基準が区別されていません");
  assert.ok(Math.abs(Number(pitchDescription[1]) - correction.input.frequency) < 0.2, "元の検出Hzが変更されました");
  assert.ok(Math.abs(Number(pitchDescription[2]) - correction.input.frequency * 2) < 0.2, "補正後のHzが2倍ではありません");
  assert.equal(correction.microphoneRequests.length, 1, "補正変更でマイクを再開始しました");
  assert.equal(correction.audioContexts[0].state, "running");
  await click(correction, "tuningOctaveUp");
  assertNote(correction, notes[12]);
  correction.input.frequency = notes[1].frequency * 2 ** (2 / 12);
  correction.advance(240);
  assertNote(correction, notes[13]);
  await click(correction, "tuningOctaveNone");
  assertOctave(correction, "0");
  correction.advance(240);
  assertNote(correction, notes[1]);
  await click(correction, "tuningOctaveDown");
  correction.input.frequency = notes[12].frequency * 2 ** (2 / 12 + 1);
  correction.advance(240);
  assertNote(correction, notes[12]);
  await click(correction, "performanceMode");
  assertReleased(correction);
  await element(correction, "noteImage").dispatch("pointerdown", pointerAt(notes[12]));
  assert.equal(correction.audioContexts.at(-1).oscillators[0].frequency.value, notes[12].frequency * 2 ** (2 / 12), "表示補正が演奏音へ影響しました");
  await element(correction, "noteImage").dispatch("pointerup", { pointerId: 1 });
  await click(correction, "tuningMode");
  assertOctave(correction, "-1");
  assert.equal(correction.storage.get("goeikaapp:tuningOctaveShift"), "-1");
  assert.equal(correction.storage.get("goeikaapp:keyShift"), "2");

  const switching = createAppEnvironment();
  await element(switching, "noteImage").dispatch("pointerdown", pointerAt(notes[12]));
  await click(switching, "tuningMode");
  assertSoundStopped(switching, "調律モードへの切替で演奏が停止しません");
  assert.equal(switching.audioContexts[0].state, "closed");
  await element(switching, "noteImage").dispatch("pointerdown", pointerAt(notes[12]));
  await element(switching, "noteImage").dispatch("pointermove", pointerAt(notes[0]));
  assert.equal(switching.audioContexts.length, 1, "調律モードで演奏用Contextを作成しました");
  assert.equal(isLit(switching), false, "調律モードのタップで点灯しました");
  await click(switching, "performanceMode");
  await element(switching, "noteImage").dispatch("pointerdown", pointerAt(notes[12]));
  assert.equal(switching.audioContexts[1].oscillators.length, 4, "演奏モードに戻ると発音できません");
  await element(switching, "noteImage").dispatch("pointerup", { pointerId: 1 });

  for (const sampleRate of [44100, 48000]) {
    for (const shift of [-12, 0, 12]) {
      const environment = await startTuning({ sampleRate, storage: { "goeikaapp:keyShift": String(shift) } });
      for (const note of notes) {
        environment.input.frequency = note.frequency * 2 ** (shift / 12 + (note.no % 2 ? 20 : -20) / 1200);
        environment.advance(280);
        assertNote(environment, note);
      }
      for (const harmonics of [[0.15, 1], [0.15, 0, 1]]) {
        environment.input.harmonics = harmonics;
        for (const note of [notes[0], notes[12], notes[24]]) {
          environment.input.frequency = note.frequency * 2 ** (shift / 12);
          environment.advance(280);
          assertNote(environment, note);
        }
      }
      environment.input.harmonics = [1];
      // 音量の周期的な変動を、1オクターブ下や3分の1の音として採用しない。
      environment.input.modulationDepth = 0.3;
      for (const divisor of [2, 3, 1.5]) {
        environment.input.modulationDivisor = divisor;
        for (const note of notes) {
          environment.input.frequency = note.frequency * 2 ** (shift / 12);
          environment.advance(280);
          assertNote(environment, note);
        }
      }
      environment.input.modulationDepth = 0;
      for (const frequency of [50, 2000, 2200, 2500, 3000, 3500]) {
        environment.input.frequency = frequency;
        environment.advance(280);
        assert.equal(isLit(environment), false, `音域外の${frequency}Hzを低い周期と誤認しました`);
      }
      await click(environment, "microphoneToggle");
      assertReleased(environment);
    }
  }

  const response = await startTuning();
  response.input.frequency = 440;
  response.advance(40);
  assert.equal(isLit(response), false, "最初の検出だけで点灯しました");
  response.advance(40);
  assertNote(response, notes[12]);
  response.input.frequency = 880;
  response.advance(40);
  assertNote(response, notes[12]);
  response.advance(40);
  assertNote(response, notes[24]);
  await click(response, "microphoneToggle");
  assertReleased(response);

  const resized = await startTuning({ resizeObserver: true });
  resized.input.frequency = 440;
  resized.advance(80);
  assertNote(resized, notes[12]);
  const resizedImage = element(resized, "noteImage");
  resizedImage.offsetWidth = 500;
  resizedImage.offsetHeight = 500;
  const imageObserver = resized.resizeObservers.find(observer => observer.target === resizedImage);
  assert.ok(imageObserver, "音符画像のサイズ変更を監視していません");
  imageObserver.callback();
  assert.equal(element(resized, "notePressMarker").style.left, `${notes[12].xRatio * 500}px`);
  assert.equal(element(resized, "notePressMarker").style.top, `${notes[12].yRatio * 500}px`);
  await click(resized, "microphoneToggle");
  assertReleased(resized);

  for (const sampleRate of [44100, 48000]) {
    const boundaries = await startTuning({ sampleRate, storage: {
      "goeikaapp:keyShift": "2", "goeikaapp:tuningOctaveShift": "1"
    } });
    for (let index = 0; index < notes.length - 1; index++) {
      for (const cents of [40, 50, 60]) {
        boundaries.input.frequency = 0;
        boundaries.advance(200);
        const frequency = cents === 50
          ? Math.sqrt(notes[index].frequency * notes[index + 1].frequency)
          : notes[index].frequency * 2 ** (cents / 1200);
        boundaries.input.frequency = frequency * 2 ** (2 / 12 - 1);
        boundaries.advance(240);
        if (cents !== 50) {
          assertNote(boundaries, notes[index + (cents > 50 ? 1 : 0)]);
        } else {
          assert.ok(isLit(boundaries), `${index + 1}番と${index + 2}番の中間に判定の空白があります`);
          const marker = element(boundaries, "notePressMarker");
          assert.ok([notes[index], notes[index + 1]].some(note =>
            marker.style.left === `${note.xRatio * 1000}px` && marker.style.top === `${note.yRatio * 1000}px`
          ), "中間の音を隣接する音符以外に割り当てました");
        }
      }
    }
    await click(boundaries, "microphoneToggle");
    assertReleased(boundaries);
  }

  const edges = await startTuning();
  for (const [note, cents, expected] of [
    [notes[0], -49, true], [notes[0], -55, false],
    [notes[24], 49, true], [notes[24], 55, false]
  ]) {
    edges.input.frequency = note.frequency * 2 ** (cents / 1200);
    edges.advance(240);
    if (expected) assertNote(edges, note);
    else assert.equal(isLit(edges), false, "音域外の音を端の音符へ丸めました");
  }
  await click(edges, "microphoneToggle");
  assertReleased(edges);

  for (const sampleRate of [44100, 48000]) {
    const stable = await startTuning({ sampleRate, storage: {
      "goeikaapp:keyShift": "2", "goeikaapp:tuningOctaveShift": "1"
    } });
    const baseFrequency = notes[12].frequency * 2 ** (2 / 12 - 1);
    stable.input.frequency = baseFrequency;
    stable.advance(80);
    assertNote(stable, notes[12]);
    for (const cents of [49, 51, 49, 55, 45, 58, 52]) {
      stable.input.frequency = baseFrequency * 2 ** (cents / 1200);
      stable.advance(80);
      assertNote(stable, notes[12]);
    }
    stable.input.frequency = baseFrequency * 2 ** (65 / 1200);
    stable.advance(40);
    assertNote(stable, notes[12]);
    stable.advance(40);
    assertNote(stable, notes[13]);
    for (const cents of [51, 49, 45, 55, 42]) {
      stable.input.frequency = baseFrequency * 2 ** (cents / 1200);
      stable.advance(80);
      assertNote(stable, notes[13]);
    }
    stable.input.frequency = baseFrequency * 2 ** (35 / 1200);
    stable.advance(40);
    assertNote(stable, notes[13]);
    stable.advance(40);
    assertNote(stable, notes[12]);
    stable.input.frequency = 0;
    stable.advance(200);
    assert.equal(isLit(stable), false, "揺れの保持処理で無音後も点灯しています");
    stable.input.frequency = baseFrequency * 2 ** (55 / 1200);
    stable.advance(80);
    assertNote(stable, notes[13]);
    await click(stable, "microphoneToggle");
    assertReleased(stable);
  }

  const tuning = await startTuning();
  const request = tuning.microphoneRequests[0];
  assert.equal(request.video, false);
  for (const name of ["autoGainControl", "noiseSuppression", "echoCancellation"]) assert.equal(request.audio[name].ideal, false);
  assert.equal(tuning.navigator.audioSession.type, "play-and-record");
  assert.equal(tuning.audioContexts[0].gains.length, 0, "マイク入力が出力に接続されました");
  tuning.input.frequency = 440;
  tuning.advance(40);
  assert.equal(isLit(tuning), false, "一瞬の音で点灯しました");
  tuning.input.frequency = 0;
  tuning.advance(200);
  tuning.input.frequency = 440 * 2 ** (20 / 1200);
  tuning.advance(240);
  assertNote(tuning, notes[12]);
  assert.match(element(tuning, "microphonePitch").textContent, /検出：\d+\.\d Hz ／ 点灯基準：五 440\.0 Hz/);
  const oldLevel = element(tuning, "microphoneLevel").value;
  tuning.input.frequency = 880;
  tuning.advance(240);
  assertNote(tuning, notes[24]);
  assert.ok(Math.abs(element(tuning, "microphoneLevel").value - oldLevel) < 1, "音程により音量メーターが変化しました");
  for (const frequency of [100, 1500, 0]) {
    tuning.input.frequency = frequency;
    tuning.advance(280);
    assert.equal(isLit(tuning), false, `音域外・無音(${frequency})で点灯しました`);
  }
  tuning.input.frequency = 440;
  tuning.advance(240);
  tuning.input.frequency = 440 * 2 ** (40 / 1200);
  tuning.advance(240);
  assertNote(tuning, notes[12]);
  tuning.input.frequency = 0;
  tuning.advance(80);
  assert.equal(isLit(tuning), true, "声の短い途切れで点滅しました");
  tuning.advance(160);
  assert.equal(isLit(tuning), false, "消灯猶予を過ぎても点灯しています");
  tuning.input.frequency = 440;
  tuning.input.harmonics = [0.15, 1];
  tuning.advance(240);
  assertNote(tuning, notes[12]);
  await click(tuning, "keyUp");
  assert.equal(isLit(tuning), false, "キー変更時に古い判定が残っています");
  assert.equal(element(tuning, "microphonePitch").textContent, "検出：— ／ 点灯基準：—");
  tuning.input.harmonics = [1];
  tuning.input.frequency = notes[12].frequency * 2 ** (1 / 12);
  tuning.advance(240);
  assertNote(tuning, notes[12]);
  assert.match(element(tuning, "microphonePitch").textContent, /点灯基準：五 466\.2 Hz/);
  await tuning.window.dispatch("resize");
  tuning.advance(40);
  assertNote(tuning, notes[12]);
  await click(tuning, "performanceMode");
  assertReleased(tuning);
  assert.equal(tuning.navigator.audioSession.type, "playback");
  await element(tuning, "noteImage").dispatch("pointerdown", pointerAt(notes[12]));
  assert.equal(tuning.audioContexts.at(-1).oscillators.length, 4);
  await element(tuning, "noteImage").dispatch("pointerup", { pointerId: 1 });

  const noise = await startTuning();
  noise.input.noise = 0.2;
  noise.advance(320);
  assert.equal(isLit(noise), false, "雑音を音程として採用しました");
  noise.input.noise = 0;
  noise.input.frequency = 440;
  noise.input.amplitude = 0.006;
  noise.advance(240);
  assert.equal(isLit(noise), false, "感度の最小音量を無視しています");
  element(noise, "microphoneSensitivity").value = "10";
  await element(noise, "microphoneSensitivity").dispatch("input");
  noise.advance(240);
  assertNote(noise, notes[12]);
  element(noise, "microphoneSensitivity").value = "1";
  await element(noise, "microphoneSensitivity").dispatch("input");
  noise.advance(240);
  assert.equal(isLit(noise), false, "感度を下げても小さい声を無視しません");
  await click(noise, "microphoneToggle");

  const sensitivityGate = await startTuning();
  sensitivityGate.input.frequency = 440;
  for (const [sensitivity, meter, expected] of [
    [1, 50, false], [1, 64, false], [1, 66, true], [10, 9, false], [10, 11, true]
  ]) {
    element(sensitivityGate, "microphoneSensitivity").value = String(sensitivity);
    await element(sensitivityGate, "microphoneSensitivity").dispatch("input");
    sensitivityGate.input.amplitude = Math.sqrt(2) * 10 ** ((meter * 0.6 - 60) / 20);
    sensitivityGate.advance(240);
    assert.ok(Math.abs(element(sensitivityGate, "microphoneLevel").value - meter) < 0.2, "入力レベルが想定と異なります");
    if (expected) assertNote(sensitivityGate, notes[12]);
    else assert.equal(isLit(sensitivityGate), false, `感度${sensitivity}で入力レベル${meter}%の音を除外しません`);
  }
  await click(sensitivityGate, "microphoneToggle");
  assertReleased(sensitivityGate);

  const ambientSensitivity = createAppEnvironment();
  ambientSensitivity.input.noise = 0.02;
  await click(ambientSensitivity, "tuningMode");
  await click(ambientSensitivity, "microphoneToggle");
  ambientSensitivity.advance(1320);
  assert.ok(element(ambientSensitivity, "microphoneLevel").value > 30 && element(ambientSensitivity, "microphoneLevel").value < 40);
  ambientSensitivity.input.frequency = 440;
  ambientSensitivity.input.amplitude = 0.07;
  element(ambientSensitivity, "microphoneSensitivity").value = "1";
  await element(ambientSensitivity, "microphoneSensitivity").dispatch("input");
  ambientSensitivity.advance(240);
  assert.equal(isLit(ambientSensitivity), false, "周囲音がある状態で感度1が小声を除外しません");
  element(ambientSensitivity, "microphoneSensitivity").value = "10";
  await element(ambientSensitivity, "microphoneSensitivity").dispatch("input");
  ambientSensitivity.advance(240);
  assertNote(ambientSensitivity, notes[12]);
  await click(ambientSensitivity, "microphoneToggle");
  assertReleased(ambientSensitivity);

  const backgroundNoise = createAppEnvironment();
  backgroundNoise.input.noise = 0.05;
  await click(backgroundNoise, "tuningMode");
  await click(backgroundNoise, "microphoneToggle");
  backgroundNoise.advance(1320);
  backgroundNoise.input.noise = 0;
  backgroundNoise.input.frequency = 440;
  backgroundNoise.input.amplitude = 0.05;
  backgroundNoise.advance(240);
  assert.equal(isLit(backgroundNoise), false, "開始時の周囲音を判定基準に反映していません");
  backgroundNoise.input.amplitude = 0.2;
  backgroundNoise.advance(240);
  assertNote(backgroundNoise, notes[12]);
  await click(backgroundNoise, "microphoneToggle");

  for (const [options, expected] of [
    [{ secureContext: false }, /HTTPS/],
    [{ microphoneUnsupported: true }, /対応していません/],
    [{ audioUnsupported: true }, /対応していません/],
    [{ microphoneError: { name: "NotAllowedError" } }, /許可設定/],
    [{ microphoneError: { name: "NotFoundError" } }, /見つかりません/],
    [{ microphoneError: { name: "NotReadableError" } }, /使用中/],
    [{ resumeError: new Error("再開失敗") }, /もう一度/]
  ]) {
    const environment = createAppEnvironment(options);
    await click(environment, "tuningMode");
    await click(environment, "microphoneToggle");
    assert.match(element(environment, "microphoneStatus").textContent, expected);
    assert.equal(element(environment, "microphoneStatus").hidden, false, "マイクのエラーが隠れています");
    assertReleased(environment);
  }

  for (const phase of ["permission", "resume"]) {
    for (const action of ["stop", "mode", "hidden", "pagehide"]) {
      const gate = createDeferred();
      const environment = createAppEnvironment(phase === "permission"
        ? { microphoneGate: gate.promise } : { resumeGate: gate.promise });
      await click(environment, "tuningMode");
      const pending = click(environment, "microphoneToggle");
      assert.equal(environment.microphoneRequests.length, 1);
      assert.equal(element(environment, "microphoneLevelState").textContent, "許可待ち");
      // 許可済みでもAudioContextの再開待ちが残る順序を再現する。
      if (phase === "resume") {
        await Promise.resolve();
        await Promise.resolve();
      }
      if (action === "stop") await click(environment, "microphoneToggle");
      if (action === "mode") await click(environment, "performanceMode");
      if (action === "hidden") {
        environment.document.hidden = true;
        environment.document.visibilityState = "hidden";
        await environment.document.dispatch("visibilitychange");
      }
      if (action === "pagehide") await environment.window.dispatch("pagehide");
      gate.resolve(phase === "permission" ? environment.createStream() : undefined);
      await pending;
      environment.advance(2000);
      assertReleased(environment);
      assert.ok(environment.audioContexts.every(audio => audio.sources.length === 0), "取り消した入力の解析を開始しました");
    }
  }

  const oldPermission = createDeferred();
  const newPermission = createDeferred();
  let requests = 0;
  const repeated = createAppEnvironment({ getUserMedia: () => ++requests === 1 ? oldPermission.promise : newPermission.promise });
  await click(repeated, "tuningMode");
  const oldStart = click(repeated, "microphoneToggle");
  await click(repeated, "microphoneToggle");
  const newStart = click(repeated, "microphoneToggle");
  const currentStream = repeated.createStream();
  newPermission.resolve(currentStream);
  await newStart;
  const staleStream = repeated.createStream();
  oldPermission.resolve(staleStream);
  await oldStart;
  assert.equal(staleStream.track.readyState, "ended", "古い許可要求の入力が残っています");
  assert.equal(currentStream.track.readyState, "live", "古い処理が現在の入力を停止しました");
  assert.equal(element(repeated, "microphoneLevelState").textContent, "測定中");
  await click(repeated, "microphoneToggle");
  assertReleased(repeated);

  for (const action of ["hidden", "pagehide", "ended", "interrupted"]) {
    const environment = await startTuning();
    environment.input.frequency = 440;
    environment.advance(240);
    assertNote(environment, notes[12]);
    if (action === "hidden") {
      environment.document.hidden = true;
      environment.document.visibilityState = "hidden";
      await environment.document.dispatch("visibilitychange");
    }
    if (action === "pagehide") await environment.window.dispatch("pagehide");
    if (action === "ended") await environment.streams[0].track.dispatch("ended");
    if (action === "interrupted") {
      environment.audioContexts[0].state = "interrupted";
      environment.audioContexts[0].onstatechange();
    }
    assertReleased(environment);
    environment.document.hidden = false;
    environment.document.visibilityState = "visible";
    await environment.document.dispatch("visibilitychange");
    assert.equal(environment.microphoneRequests.length, 1, "復帰時にマイクを自動開始しました");
    await click(environment, "microphoneToggle");
    assert.equal(environment.microphoneRequests.length, 2, "中断後にマイクを再開できません");
    await click(environment, "microphoneToggle");
    assertReleased(environment);
  }
}

runChecks()
  .then(() => console.log("Project checks passed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
