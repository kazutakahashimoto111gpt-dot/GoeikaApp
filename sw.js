// ====================================================
// キャッシュの名前
// ====================================================
//
// 【重要】
//
// このアプリでは、
//
//   HTML
//   CSS
//   JavaScript
//   画像
//
// などのアプリ用ファイルを
//
//   「キャッシュ優先」
//
// で読み込む。
//
//
// そのため、アプリを更新するときは
//
//   CACHE_NAME
//
// も必ず新しい名前へ変更する。

// ----------------------------------------------------
// Service Worker自体の更新について
// ----------------------------------------------------
//
// CACHE_NAMEを変更しなくても、
// sw.jsそのものに変更があれば、
//
// ブラウザは新しいService Workerとして
// 検出することがある。
//
//
// しかし、このアプリでは
// アプリ本体のバージョンとキャッシュを
// 分かりやすく一致させるため、
//
//   アプリ更新
//        ↓
//   CACHE_NAMEも更新
//
// という運用に統一する。
//
//
// ====================================================

const CACHE_PREFIX =
  "goeikaapp-main-";

const CACHE_NAME =
  CACHE_PREFIX + "v1.0.49";

// 旧main版と現行main版のバージョン付きキャッシュだけを管理する。
const MAIN_CACHE_NAME_PATTERN =
  /^goeikaapp-main-v\d+\.\d+\.\d+$/;
const LEGACY_MAIN_CACHE_NAME_PATTERN =
  /^goeikaapp-v\d+\.\d+\.\d+$/;



// ========================================
// 最初にキャッシュしておくファイル
// ========================================

/*
  新しいService Workerが
  インストールされるときに、

  以下のファイルをまとめて
  新しいキャッシュへ保存する。


  このアプリでは、

  HTML
  CSS
  JavaScript
  画像
  PWA設定
  アイコン

  など、アプリを動かすために必要な
  主要ファイルをここへ登録しておく。
*/

const FILES_TO_CACHE = [

  "./",

  "./style.css",

  "./script.js",

  "./manifest.json",

  "./notes.js",

  "./note-keys-outward-sample-v5-octagon-transparent-15px-precise.png",

  "./icons/favicon-48.png",


  // -----------------------------
  // PWAアイコン
  // -----------------------------

  "./icons/icon-192.png",

  "./icons/icon-512.png",

  "./icons/apple-touch-icon.png"

];


/*
  実行時にキャッシュへ保存してよいURLを、
  事前キャッシュ対象だけに限定する。
*/
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



// ========================================
// ① Service Worker のインストール
// ========================================

self.addEventListener(
  "install",

  event => {


    /*
      新しいService Workerが見つかると、

      まずinstall処理が実行される。


      この段階で、

      CACHE_NAMEで指定した
      新しいキャッシュを作り、

      FILES_TO_CACHEに登録された
      ファイルを保存する。
    */

    event.waitUntil(


      caches.open(
        CACHE_NAME
      )


        .then(cache => {


          /*
            addAll()を使って、

            FILES_TO_CACHEに登録された
            ファイルをまとめて取得し、

            キャッシュへ保存する。


            たとえば、

            index.html
            style.css
            script.js

            が更新されていれば、

            このタイミングで
            新しい内容がキャッシュされる。
          */

          return cache.addAll(
            FILES_TO_CACHE
          );


        })


    );


  }
);



// ========================================
// ② 更新通知からの即時有効化
// ========================================

self.addEventListener(
  "message",

  event => {

    if (
      event.data &&
      event.data.type ===
        "SKIP_WAITING"
    ) {

      /*
        新しいキャッシュの準備が終わったworkerだけが
        waiting状態でこのメッセージを受け取る。
      */
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



// ========================================
// ③ 新しいService Workerの有効化
// ========================================

self.addEventListener(
  "activate",

  event => {


    /*
      新しいService Workerが

        install
           ↓
        waiting
           ↓
        activate

      と進み、

      実際に有効化されるときに
      この処理が実行される。


      ここでは、

      main版のバージョン付きキャッシュだけを削除する。
    */

    event.waitUntil(


      caches.keys()


        .then(cacheNames => {


          /*
            caches.keys()によって、

            現在保存されている
            キャッシュの名前をすべて取得する。
          */

          return Promise.all(


            cacheNames.map(
              cacheName => {


                /*
                  現在使用する

                    CACHE_NAME

                  と違い、かつmain版の命名規則に
                  完全一致する名前だけを
                  古いキャッシュと判断する。
                */

                if (
                  cacheName !== CACHE_NAME &&
                  (
                    MAIN_CACHE_NAME_PATTERN.test(cacheName) ||
                    LEGACY_MAIN_CACHE_NAME_PATTERN.test(cacheName)
                  )
                ) {


                  /*
                    古いキャッシュを削除する。
                  */

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



// ========================================
// ④ 通信処理
//
// 【キャッシュ優先】
//
// HTML
// CSS
// JavaScript
// 画像
//
// このアプリの許可済みURLだけを、
//
//   まずキャッシュ
//        ↓
//   なければネット
//
// の順番で取得する。
// ========================================

self.addEventListener(
  "fetch",

  event => {


    // -------------------------------------
    // GET通信だけを対象にする
    // -------------------------------------

    /*
      ファイルを取得する通常の通信は
      GETで行われる。


      POSTなど別の種類の通信については、

      このService Workerでは
      特別な処理を行わない。
    */

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



    // =====================================
    // キャッシュ優先で取得
    // =====================================

    event.respondWith(


      /*
        まず、

        「このリクエストと同じものが
          キャッシュに保存されているか？」

        を調べる。
      */

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


          // ---------------------------------
          // キャッシュにあった場合
          // ---------------------------------

          if (
            cachedResponse
          ) {


            /*
              キャッシュにあれば、

              ネットワークへ取りに行かず
              そのままキャッシュを返す。


              これが

                「キャッシュ優先」

              の中心となる処理。
            */

            return cachedResponse;


          }



          // ---------------------------------
          // キャッシュになかった場合
          // ---------------------------------

          /*
            キャッシュに存在しなかった場合だけ、

            ネットワークから取得する。
          */

          return fetch(
            event.request
          )


            .then(networkResponse => {


              /*
                ネットから取得できたファイルを
                キャッシュにも保存する。


                ただし、

                ・正常なレスポンス

                ・自分のサイトのファイル

                の場合だけ保存する。
              */

              if (
                networkResponse &&
                networkResponse.status === 200 &&
                CACHEABLE_URLS.has(
                  event.request.url
                )
              ) {


                /*
                  Responseのbodyは
                  基本的に一度しか使用できない。


                  このあと、

                  ① キャッシュへ保存

                  ② ブラウザへ返す

                  の両方で使いたいので、

                  clone()で複製する。
                */

                const responseClone =
                  networkResponse.clone();



                // -----------------------------
                // 現在のキャッシュを開く
                // -----------------------------

                return caches.open(
                  CACHE_NAME
                )


                  .then(cache => {


                    /*
                      ネットから取得したファイルを
                      キャッシュへ追加する。


                      次回同じファイルが
                     要求されたときには、

                      キャッシュから
                      すぐ取得できるようになる。
                    */

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



              /*
                元のnetworkResponseは、

                実際にページを表示している
                ブラウザへ返す。
              */

              return networkResponse;


            });


        })


    );


  }
);
