// ====================================================
// キャッシュの名前
//
// 大きな仕様変更や、キャッシュを一式更新したいときに
// バージョンを変更する
// ====================================================

const CACHE_NAME = "v1.0.4";


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
  "./icons/apple-touch-icon.png"
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
// ③ ネットワーク優先
//
// オンライン
//   → ネットから最新版を取得して表示
//   → 同時にキャッシュも最新版へ更新
//
// オフライン
//   → キャッシュから表示
// ========================================

self.addEventListener("fetch", event => {

  // GET通信だけを対象にする
  if (event.request.method !== "GET") {
    return;
  }


  event.respondWith(

    // ----------------------------
    // まずネットから最新版を取得
    // ----------------------------

    fetch(event.request, {
      cache: "no-store"
    })

      .then(networkResponse => {

        // ----------------------------
        // 正常に取得できたものだけ
        // キャッシュにも保存
        // ----------------------------

        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.url.startsWith(self.location.origin)
        ) {

          const responseClone =
            networkResponse.clone();


          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                responseClone
              );

            });

        }


        // ----------------------------
        // ネットから取得した最新版を表示
        // ----------------------------

        return networkResponse;

      })


      // ----------------------------
      // ネットから取得できなかった場合
      // ----------------------------

      .catch(() => {

        // キャッシュから表示

        return caches.match(
          event.request
        );

      })

  );

});