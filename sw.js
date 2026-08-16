// ====================================================
// キャッシュの名前
//
// 大きな仕様変更や、キャッシュを一式更新したいときにバージョンを変更する
// CACHE_NAMEを変えなくても、sw.jsの他の部分に変更点があれば、ブラウザは自動的に新しいService Workerとしてインストールする
// したがって、CACHE_NAMEを変えるのは、キャッシュの中身を一式更新したいときだけでよい
// ====================================================

const CACHE_NAME = "v1.0.3";


// ========================================
// 最初にキャッシュしておくファイル
// ========================================

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./notes.js",
  "./note.png",

  // PWAアイコン
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];


// ==========================================================================================================
// ① Service Worker のインストール
// 　ブラウザは sw.js の内容を以前のものと比較して、変更点があれば新しいService Workerとして自動的にインストールする
// ==========================================================================================================

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
// ③ 通信処理
//
// 画像
//   → キャッシュ優先
//
// HTML / CSS / JavaScriptなど
//   → ネットワーク優先
// ========================================

self.addEventListener("fetch", event => {

  // GET通信だけを対象にする
  if (event.request.method !== "GET") {
    return;
  }


  // =====================================
  // 画像の場合
  //
  // キャッシュ優先
  // =====================================

  if (
    event.request.destination === "image"
  ) {

    event.respondWith(

      caches.match(event.request)

        .then(cachedResponse => {

          // キャッシュがあれば即表示
          if (cachedResponse) {
            return cachedResponse;
          }


          // キャッシュになければネットから取得
          return fetch(event.request)

            .then(networkResponse => {

              // 正常に取得できた画像を
              // キャッシュにも保存

              if (
                networkResponse &&
                networkResponse.status === 200 &&
                event.request.url.startsWith(self.location.origin) /*リクエスト先URLが、sw.js が配信されているオリジンか？*/
              ) {

                const responseClone =
                  networkResponse.clone();
                  /*networkResponse を複製して、もう一つ同じレスポンスを作る
                  　Response の中身（body）は基本的に一度しか読み取れないため。
                  　ここでは以下のような用途になる。
                  
                  　networkResponse
                          │
                          ├── clone() → キャッシュ保存用
                          │
                          └─────────→ ブラウザに返す用*/


                caches.open(CACHE_NAME)
                  .then(cache => {

                    cache.put(
                      event.request,
                      responseClone
                    );

                  });

              }


              return networkResponse;

            });

        })

    );


    // ここで終了
    return;

  }


  // =====================================
  // 画像以外
  //
  // ネットワーク優先
  // =====================================

  event.respondWith(

    fetch(event.request, {
      cache: "no-store"
    })

      .then(networkResponse => {

        // 正常に取得できたものだけ
        // キャッシュにも保存

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


        // ネットから取得した最新版を表示

        return networkResponse;

      })


      // ネットから取得できなかった場合
      // キャッシュを使用

      .catch(() => {

        return caches.match(
          event.request
        );

      })

  );

});