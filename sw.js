// 静的ファイルはキャッシュ優先で配信するため、アプリ更新時に名前も更新する。

const CACHE_PREFIX =
  "goeikaapp-main-";

const CACHE_NAME =
  CACHE_PREFIX + "v1.0.51";

// 旧main版と現行main版のバージョン付きキャッシュだけを管理する。
const MAIN_CACHE_NAME_PATTERN =
  /^goeikaapp-main-v\d+\.\d+\.\d+$/;
const LEGACY_MAIN_CACHE_NAME_PATTERN =
  /^goeikaapp-v\d+\.\d+\.\d+$/;



// オフライン動作に必要な静的ファイルをインストール時に保存する。

const FILES_TO_CACHE = [

  "./",

  "./style.css",

  "./script.js",

  "./manifest.json",

  "./notes.js",

  "./note-keys-outward-sample-v5-octagon-transparent-15px-precise.png",

  "./icons/favicon-48.png",


  "./icons/icon-192.png",

  "./icons/icon-512.png",

  "./icons/apple-touch-icon.png"

];


// 意図しないレスポンスを保存しないよう、実行時の保存先も許可済みURLに限定する。
const CACHEABLE_URLS =
  new Set(
    FILES_TO_CACHE.map(
      filePath =>
        new URL(
          filePath,
          self.location.href
        ).href
    )
  );

const APP_ROOT_URL =
  new URL(self.registration.scope);
const APP_INDEX_URL =
  new URL("index.html", APP_ROOT_URL);



// Service Workerのインストール

self.addEventListener(
  "install",

  event => {


    event.waitUntil(


      caches.open(
        CACHE_NAME
      )


        .then(cache => {


          return cache.addAll(
            FILES_TO_CACHE
          );


        })


    );


  }
);



// 更新通知からの即時有効化

self.addEventListener(
  "message",

  event => {

    if (
      event.data &&
      event.data.type ===
        "SKIP_WAITING"
    ) {

      // 事前キャッシュ済みの待機中workerを有効化する。
      self.skipWaiting();

    }

    if (
      event.data &&
      event.data.type ===
        "GET_CACHE_NAME" &&
      event.ports[0]
    ) {

      event.ports[0].postMessage({
        cacheName: CACHE_NAME
      });

    }

  }
);



// Service Workerの有効化

self.addEventListener(
  "activate",

  event => {


    event.waitUntil(


      caches.keys()


        .then(cacheNames => {


          return Promise.all(


            cacheNames.map(
              cacheName => {


                // 他アプリのデータを守るため、main版の旧キャッシュだけを削除する。
                if (
                  cacheName !== CACHE_NAME &&
                  (
                    MAIN_CACHE_NAME_PATTERN.test(cacheName) ||
                    LEGACY_MAIN_CACHE_NAME_PATTERN.test(cacheName)
                  )
                ) {


                  return caches.delete(
                    cacheName
                  );


                }


              }
            )


          );


        })


    );

  }
);



// 許可済みのアプリ内URLをキャッシュ優先で取得する。

self.addEventListener(
  "fetch",

  event => {


    if (
      event.request.method !==
      "GET"
    ) {

      return;

    }

    const requestUrl =
      new URL(event.request.url);
    const isAppNavigation =
      event.request.mode === "navigate" &&
      requestUrl.origin === APP_ROOT_URL.origin &&
      (
        requestUrl.pathname === APP_ROOT_URL.pathname ||
        requestUrl.pathname === APP_INDEX_URL.pathname
      );

    if (
      !isAppNavigation &&
      !CACHEABLE_URLS.has(event.request.url)
    ) {
      return;
    }



    event.respondWith(
      caches.open(
        CACHE_NAME
      )

        .then(async cache => {
          const cachedResponse =
            await cache.match(event.request);

          return cachedResponse ||
            (isAppNavigation
              ? cache.match(APP_ROOT_URL.href)
              : undefined);
        })


        .then(cachedResponse => {


          if (
            cachedResponse
          ) {


            return cachedResponse;


          }



          return fetch(
            event.request
          )


            .then(networkResponse => {


              if (
                networkResponse &&
                networkResponse.status === 200 &&
                CACHEABLE_URLS.has(
                  event.request.url
                )
              ) {


                // レスポンス本体をキャッシュ保存と返却の両方で使う。
                const responseClone =
                  networkResponse.clone();



                return caches.open(
                  CACHE_NAME
                )


                  .then(cache => {


                    return cache.put(
                      event.request,
                      responseClone
                    );


                  })


                  .catch(error => {

                    console.warn(
                      "取得したファイルをキャッシュへ保存できませんでした。",
                      error
                    );

                  })


                  .then(() =>
                    networkResponse
                  );


              }



              return networkResponse;


            });


        })


    );


  }
);
