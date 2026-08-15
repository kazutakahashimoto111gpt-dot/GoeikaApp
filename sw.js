// ====================================================
// キャッシュの名前
// 大きな仕様変更をしたときは v2, v3... と変更する
// 内容を変更してキャッシュ名を変更し忘れると、更新されない
// ====================================================

const CACHE_NAME = "goeika-v2";


// ========================================
// 最初にキャッシュしておくファイル
// ========================================

const FILES_TO_CACHE = [
  "./", 
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",

  // PWAアイコン
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];


// ========================================
// ① Service Worker のインストール
// ========================================

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );

  // 新しいService Workerをすぐ有効化
  self.skipWaiting();

});


// ========================================
// ② 古いキャッシュを自動削除
// ========================================

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(cacheNames => {

        return Promise.all(

          cacheNames.map(cacheName => {

            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }

          })

        );

      })
      .then(() => self.clients.claim())

  );

});


// ========================================
// ③ キャッシュから即表示しつつ、裏で最新版を取得
// ========================================

self.addEventListener("fetch", event => {

  // GET通信だけを対象にする
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        // ----------------------------
        // 裏でネットから最新版を取得
        // ----------------------------
        const fetchPromise = fetch(event.request)

          .then(networkResponse => {

            // 正常に取得できたものだけ保存
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              event.request.url.startsWith(self.location.origin)
            ) {

              const responseClone = networkResponse.clone();

              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });

            }

            return networkResponse;

          })

          .catch(() => {
            // オフラインなどで取得失敗した場合は何もしない
          });


        // ----------------------------
        // キャッシュがあれば即返す
        // ----------------------------
        if (cachedResponse) {
          return cachedResponse;
        }


        // ----------------------------
        // キャッシュになければネットから返す
        // ----------------------------
        return fetchPromise;

      })

  );

});