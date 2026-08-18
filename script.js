// =====================================
// HTML要素をjsのオブジェクトとして取得
// =====================================

const image =
  document.getElementById(
    "noteImage"
  );


const flashMarker =
  document.getElementById(
    "flashMarker"
  );


const keyControl =
  document.getElementById(
    "keyControl"
  );


const keyDown =
  document.getElementById(
    "keyDown"
  );


const keyUp =
  document.getElementById(
    "keyUp"
  );


const keyDisplay =
  document.getElementById(
    "keyDisplay"
  );



// =====================================
// タップ判定半径
// =====================================

const hitRadius =
  0.05;


/*
  タップ地点と音符との距離を調べる

  距離 <= 判定半径

  かどうかを調べる
*/

const hitRadiusSquared =
  hitRadius * hitRadius;



// =====================================
// キーコントローラー位置
//
// 画像左上 = 0, 0
// 画像右下 = 1, 1
//
// この座標が
// キーコントローラーの中心になる
// =====================================

const isSmartphone =
  window.innerWidth <= 600;


const keyControlPosition = {

  x: 0.495,

  y: isSmartphone
    ? 1.10   // スマホ
    : 0.927  // PC・タブレット

};



// =====================================
// キーコントローラー位置更新
// =====================================

function updateKeyControlPosition() {

  const rect =
    image.getBoundingClientRect();


  /*
    imageAreaのサイズは
    表示されている画像サイズと同じなので、

    比率 × 表示画像サイズ

    で位置を決定できる
  */

  keyControl.style.left =
    (
      rect.width *
      keyControlPosition.x
    ) + "px";


  keyControl.style.top =
    (
      rect.height *
      keyControlPosition.y
    ) + "px";

}



// =========================================
// 画像読み込み時に
// キーコントローラーの位置設定
// =========================================

image.addEventListener(
  "load",
  updateKeyControlPosition
);



// ====================================================
// 画面サイズ変更時にも
// キーコントローラーの位置設定を再計算
// ====================================================

window.addEventListener(
  "resize",
  updateKeyControlPosition
);



// =============================================================
// 画像がキャッシュ済みの場合にも
// キーコントローラーの位置設定を再計算
// =============================================================

if (
  image.complete
) {

  updateKeyControlPosition();

}



// =====================================
// キー設定
// =====================================

let keyShift =
  Number(
    localStorage.getItem(
      "kongoKeyShift"
    )
  );


if (
  Number.isNaN(keyShift)
) {

  keyShift = 0;

}



// -------------------------------------
// -12 ～ +12 に制限
// -------------------------------------

keyShift =
  Math.max(
    -12,
    Math.min(
      12,
      keyShift
    )
  );



// =====================================
// キー倍率
// =====================================

let keyMultiplier =
  Math.pow(
    2,
    keyShift / 12
  );



// =====================================
// キー倍率更新
// =====================================

function updateKeyMultiplier() {

  keyMultiplier =
    Math.pow(
      2,
      keyShift / 12
    );

}



// =====================================
// キー表示
// =====================================

function updateKeyDisplay() {

  if (
    keyShift > 0
  ) {

    keyDisplay.textContent =
      "+" + keyShift;

  }

  else if (
    keyShift < 0
  ) {

    keyDisplay.textContent =
      keyShift;

  }

  else {

    keyDisplay.textContent =
      "±0";

  }

}



// =====================================
// キー設定保存
// =====================================

function saveKeyShift() {

  localStorage.setItem(
    "kongoKeyShift",
    keyShift
  );

}



// =====================================
// 半音下げる
// =====================================

keyDown.addEventListener(
  "click",

  function(event) {

    /*
      このキー操作はここだけのイベントとして扱い、
      親要素には処理させない
    */

    event.stopPropagation();


    if (
      keyShift <= -12
    ) {

      return;

    }


    keyShift--;


    /*
      キーが変更されたときだけ
      周波数倍率を計算する。
    */

    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



// =====================================
// 半音上げる
// =====================================

keyUp.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    if (
      keyShift >= 12
    ) {

      return;

    }


    keyShift++;


    // キー変更時だけ倍率を再計算

    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



// =====================================
// 中央ボタン
//
// 押すとキー0
// =====================================

keyDisplay.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    keyShift = 0;


    // キー0用の倍率へ更新

    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



// 最初のキー表示を更新

updateKeyDisplay();



// =====================================
// iPhone マナーモード対策
// =====================================

if (
  "audioSession" in navigator
) {

  /*
    Audio Session APIに対応しているブラウザでは
    音声を「再生用」として扱う。
  */

  navigator.audioSession.type =
    "playback";

}

// =====================================
// Media Session
// ロック画面などにアプリ情報を表示
// =====================================

if ("mediaSession" in navigator) {

  navigator.mediaSession.metadata =
    new MediaMetadata({

      title: "音符アプリ",
      artist: "someone",

    });

}

// =====================================
// AudioContext
//
// 実際に音を扱うためのオブジェクト
// ============================================


// --------------------------------------------
// 使用するAudioContextの種類を決める
// --------------------------------------------

const AudioContextClass =

  window.AudioContext ||
  window.webkitAudioContext;


/*
  通常のブラウザでは
  window.AudioContext を使用する。

  Safariなど一部の環境では
  window.webkitAudioContext が使われることがある。
*/



// --------------------------------------------
// AudioContextを作成
// --------------------------------------------

let audioContext =
  new AudioContextClass();



// ============================================
// AudioContext再作成フラグ
// ============================================

let audioContextNeedsReset =
  false;


/*
  この変数は、

  「AudioContextを作り直す必要があるか」

  を記憶するためのもの。


  false
    ↓
  作り直す必要なし


  true
    ↓
  次の音声準備時に作り直す


  という意味。


  iPhoneなどでは、

  アプリをバックグラウンドへ移動したあと
  AudioContextが正常に復帰しない場合がある。

  そのため、

  バックグラウンドへ移動したことを
  検出したら true にする。
*/



// ============================================
// AudioContextを使用可能な状態にする
// ============================================

async function ensureAudioContext() {


  // ------------------------------------------
  // バックグラウンドから復帰した場合
  // ------------------------------------------

  if (
    audioContextNeedsReset
  ) {


    /*
      古いAudioContextをそのまま信用せず、

      ユーザーが画面をタップしたときに
      新しいAudioContextへ交換する。


      ここで重要なのは、

      再作成フラグを先に解除してから
      新しいAudioContextへ交換すること。


      iPhoneで最初のresume()が
      保留状態になり、

      その間にもう一度タップされた場合でも、

      AudioContextを二重に
      作り直さないようにする。
    */


    // ----------------------------------------
    // 再作成フラグを先に解除
    // ----------------------------------------

    audioContextNeedsReset =
      false;



    // ----------------------------------------
    // 古いAudioContextを退避
    // ----------------------------------------

    const oldAudioContext =
      audioContext;



    // ----------------------------------------
    // 新しいAudioContextを先に作成
    // ----------------------------------------

    audioContext =
      new AudioContextClass();



    // ----------------------------------------
    // 古いAudioContextの終了を試す
    // ----------------------------------------

    /*
      close()の完了はここでは待たない。

      古いAudioContextの終了待ちによって、

      新しいAudioContextの準備が
      遅れることを避けるため。


      close()に失敗しても、

      新しいAudioContextは
      すでに作成済みなので、

      アプリ全体は停止させない。
    */

    if (
      oldAudioContext.state !==
      "closed"
    ) {

      oldAudioContext.close()
        .catch(
          function(error) {

            console.warn(
              "AudioContextを終了できませんでした。",
              error
            );

          }
        );

    }

  }



  // ------------------------------------------
  // closedだった場合
  // ------------------------------------------

  if (
    audioContext.state ===
    "closed"
  ) {


    /*
      closedになったAudioContextは
      resume()では復活できない。

      そのため、

      新しいAudioContextを作成する。
    */

    audioContext =
      new AudioContextClass();

  }



  // ------------------------------------------
  // suspendedだった場合
  // ------------------------------------------

  if (
    audioContext.state ===
    "suspended"
  ) {


    /*
      AudioContextが一時停止状態なら
      resume()で再開する。


      iPhoneでは、

      最初のresume()が
      すぐ完了せず、

      次のユーザー操作まで
      Promiseが保留になる場合がある。


      その場合でも、

      2回目のタップでは
      同じAudioContextに対して
      resume()を試すことができる。
    */

    await audioContext.resume();

  }

}



// ============================================
// 音声開始用オーバーレイ
// ============================================

const audioStartOverlay =
  document.getElementById(
    "audioStartOverlay"
  );


const audioStartMessage =
  document.getElementById(
    "audioStartMessage"
  );



audioStartOverlay.addEventListener(
  "pointerdown",

  function(event) {


    // ----------------------------------------
    // このタップは音声準備専用
    // ----------------------------------------

    event.preventDefault();
    // イベントに対して
    // ブラウザが本来行う標準動作を
    // キャンセルする


    event.stopPropagation();
    // 発生したイベントが
    // 親要素へ伝わっていくのを止める



    // ----------------------------------------
    // すでに音声準備が完了している場合
    // ----------------------------------------

    if (
      audioContext.state ===
        "running" &&
      !audioContextNeedsReset
    ) {


      audioStartOverlay.style.display =
        "none";


      return;

    }



    // ----------------------------------------
    // 音声の準備を開始
    // ----------------------------------------

    audioStartMessage.textContent =
      "起動中...";


    /*
      AudioContextに関する準備は

      ensureAudioContext()

      にまとめて任せる。


      初回起動なら
        ↓
      resume()


      バックグラウンド復帰後なら
        ↓
      新しいAudioContextを作成
        ↓
      古いAudioContextの終了を試す
        ↓
      resume()


      という処理になる。
    */

    ensureAudioContext()

      .then(
        function() {


          // ----------------------------------
          // 音声準備成功
          // ----------------------------------

          if (
            audioContext.state ===
              "running" &&
            !audioContextNeedsReset
          ) {


            audioStartOverlay.style.display =
              "none";

          }

        }
      )


      .catch(
        function(error) {


          console.warn(
            "AudioContextを開始できませんでした。",
            error
          );

        }
      );



    // ----------------------------------------
    // 少し待っても準備できなければ
    // 再タップを案内
    // ----------------------------------------

    setTimeout(
      function() {


        /*
          500ミリ秒経っても

          AudioContextがrunningでない、

          または

          再作成処理が必要なら、

          ユーザーへ
          もう一度タップしてもらう。
        */

        if (
          audioContext.state !==
            "running" ||
          audioContextNeedsReset
        ) {

          audioStartMessage.textContent =
            "もう一度タップしてください";

        }

      },

      500
    );

  }
);



// ============================================
// アプリの表示・非表示を検出
// ============================================

document.addEventListener(
  "visibilitychange",

  function() {


    // ----------------------------------------
    // アプリが画面から見えなくなった
    // ----------------------------------------

    if (
      document.visibilityState ===
      "hidden"
    ) {


      /*
        visibilityStateが

        hidden

        になったということは、


        ・ホーム画面へ戻った

        ・別のアプリへ切り替えた

        ・画面を閉じた

        ・ブラウザの別タブへ移動した


        などの可能性がある。


        iPhoneでは、

        このあとAudioContextが
        正常に復帰しない場合がある。


        そこで、

        次回の音声準備時に

        AudioContextを
        作り直す必要がある

        ことを記録する。
      */

      audioContextNeedsReset =
        true;

    }



    // ----------------------------------------
    // アプリが再び画面に表示された
    // ----------------------------------------

    if (
      document.visibilityState ===
      "visible"
    ) {


      /*
        復帰直後の最初の音符タップを

        AudioContextの再準備に
        消費しないようにする。


        まずオーバーレイを表示し、

        ユーザーに

        「音声を準備するためのタップ」

        をしてもらう。
      */


      // メッセージを初期状態へ戻す

      audioStartMessage.textContent =
        "タップして開始";



      // オーバーレイを再表示

      audioStartOverlay.style.display =
        "flex";

    }


  }
);

// =====================================
// 琴風サウンド
// =====================================

function playSound(
  frequency
) {


  const now =
    audioContext.currentTime;



  // ---------------------------------
  // 全体音量
  // ---------------------------------

  const masterGain =
    audioContext.createGain();


  masterGain.connect(
    audioContext.destination
  );


  /*
    音が鳴り始める瞬間は
    ほぼ無音から開始する
  */

  masterGain.gain.setValueAtTime(
    0.0001,
    now
  );


  /*
    0.01秒で
    一気に音量を上げる
  */

  masterGain.gain
    .exponentialRampToValueAtTime(
      0.6,
      now + 0.01
    );


  /*
    その後1.8秒かけて
    音量をほぼ0まで下げる
  */

  masterGain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      now + 1.8
    );



  // ---------------------------------
  // 基音
  // ---------------------------------

  const osc1 =
    audioContext.createOscillator();


  const gain1 =
    audioContext.createGain();


  osc1.type =
    "sine";


  osc1.frequency.value =
    frequency;


  gain1.gain.value =
    1.0;


  osc1.connect(
    gain1
  );


  gain1.connect(
    masterGain
  );



  // ---------------------------------
  // 2倍音
  // ---------------------------------

  const osc2 =
    audioContext.createOscillator();


  const gain2 =
    audioContext.createGain();


  osc2.type =
    "sine";


  osc2.frequency.value =
    frequency * 2;


  gain2.gain.value =
    0.35;


  osc2.connect(
    gain2
  );


  gain2.connect(
    masterGain
  );



  // ---------------------------------
  // 3倍音
  // ---------------------------------

  const osc3 =
    audioContext.createOscillator();


  const gain3 =
    audioContext.createGain();


  osc3.type =
    "sine";


  osc3.frequency.value =
    frequency * 3;


  gain3.gain.value =
    0.15;


  osc3.connect(
    gain3
  );


  gain3.connect(
    masterGain
  );



  // ---------------------------------
  // 弦を弾いた瞬間の音
  // ---------------------------------

  const clickOsc =
    audioContext.createOscillator();


  const clickGain =
    audioContext.createGain();


  /*
    基音とは少し違う
    三角波を使用する。
  */

  clickOsc.type =
    "triangle";


  /*
    基音の4倍の周波数。

    高い成分を加えることで
    弦を弾いた瞬間らしさを作る。
  */

  clickOsc.frequency.value =
    frequency * 4;


  clickGain.gain.setValueAtTime(
    0.18,
    now
  );


  /*
    0.08秒でほぼ無音にする。

    一瞬だけ鳴る
    「弦を弾いた音」を作る。
  */

  clickGain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      now + 0.08
    );


  clickOsc.connect(
    clickGain
  );


  clickGain.connect(
    masterGain
  );



  // ---------------------------------
  // 再生開始
  // ---------------------------------

  /*
    4つの音を
    同じnowから開始する。
  */

  osc1.start(
    now
  );


  osc2.start(
    now
  );


  osc3.start(
    now
  );


  clickOsc.start(
    now
  );



  // ---------------------------------
  // 再生終了
  // ---------------------------------

  osc1.stop(
    now + 1.8
  );


  osc2.stop(
    now + 1.8
  );


  osc3.stop(
    now + 1.8
  );


  clickOsc.stop(
    now + 0.1
  );

}



// =====================================
// タップ位置を光らせる
// =====================================

function flash(
  x,
  y
) {


  // ---------------------------------
  // 光る位置を設定
  // ---------------------------------

  flashMarker.style.left =
    x + "px";


  flashMarker.style.top =
    y + "px";



  // ---------------------------------
  // 前回のアニメーションを停止
  // ---------------------------------

  const animations =
    flashMarker.getAnimations();


  /*
    前回の光がまだ動いていたら
    そのアニメーションを停止する。
  */

  for (
    const animation
    of animations
  ) {

    animation.cancel();

  }



  // ---------------------------------
  // 新しい光アニメーションを開始
  // ---------------------------------

  /*
    Web Animations APIを使って
    JavaScriptから直接アニメーションする。

    見た目は以前のCSSアニメーションと
    ほぼ同じ。
  */

  flashMarker.animate(

    [

      // -------------------------------
      // 開始
      // -------------------------------

      {

        opacity: 1,

        transform:
          "translate(-50%, -50%) scale(0.35)"

      },


      // -------------------------------
      // 40%
      // -------------------------------

      {

        opacity: 0.9,

        transform:
          "translate(-50%, -50%) scale(1)",

        offset: 0.4

      },


      // -------------------------------
      // 終了
      // -------------------------------

      {

        opacity: 0,

        transform:
          "translate(-50%, -50%) scale(1.5)"

      }

    ],


    {

      /*
        350ミリ秒
        =
        0.35秒
      */

      duration: 350,


      /*
        CSSで使っていた
        ease-outと同じ動き
      */

      easing:
        "ease-out"

    }

  );

}



// =====================================
// スライド演奏開始
// =====================================

/*
  【新しく追加した機能】

  指やマウスを押したまま
  音符の上を移動すると、

  音符が切り替わった瞬間に
  次の音を鳴らす。


  たとえば、

  音符13
    ↓
  音符14
    ↓
  音符15

  と指を滑らせると、

  13 → 14 → 15

  と順番に音が鳴る。


  同じ音符の上を動いているだけでは
  何度も鳴らさない。
*/


// =====================================
// スライド演奏の状態
// =====================================

let isPointerPlaying =
  false;


/*
  現在演奏に使っている
  pointerのID。

  スマホでは複数の指を
  同時に画面へ置けるため、

  最初に押した指だけを
  演奏用として追跡する。
*/

let activePointerId =
  null;


/*
  最後に鳴らした音符。

  pointermoveは非常に細かく
  何度も発生するため、

  同じ音符を連打しないように
  ここへ記憶しておく。
*/

let lastPlayedNote =
  null;



// =====================================
// 指定位置の音符を探して鳴らす
// =====================================

function playNoteAtPointer(
  event
) {


  // ---------------------------------
  // 現在表示中の画像位置・サイズ
  // ---------------------------------

  const rect =
    image.getBoundingClientRect();



  // ---------------------------------
  // 表示画像上の座標
  // ---------------------------------

  const displayX =
    event.clientX -
    rect.left;


  const displayY =
    event.clientY -
    rect.top;



  // ---------------------------------
  // 0～1の比率座標に変換
  // ---------------------------------

  const pointerX =
    displayX /
    rect.width;


  const pointerY =
    displayY /
    rect.height;



  // ---------------------------------
  // 一番近い音符を探す準備
  // ---------------------------------

  let nearestNote =
    null;


  /*
    実際の距離ではなく
    「距離の2乗」を保存する。

    平方根を計算しなくてよいため、
    pointermoveが何度も発生する
    スライド演奏にも向いている。
  */

  let nearestDistanceSquared =
    Infinity;



  // ---------------------------------
  // すべての音符との距離を調べる
  // ---------------------------------

  for (
    const note
    of notes
  ) {


    // X方向の差

    const dx =
      pointerX -
      note.xRatio;


    // Y方向の差

    const dy =
      pointerY -
      note.yRatio;



    /*
      本来の距離は

      √(dx² + dy²)

      だが、

      一番近い音符を探すだけなら
      平方根は必要ない。

      dx² + dy²

      の大小関係だけで
      同じ結果になる。
    */

    const distanceSquared =
      dx * dx +
      dy * dy;



    /*
      今まで見つけた音符より
      今回の音符のほうが近ければ
      更新する。
    */

    if (
      distanceSquared <
      nearestDistanceSquared
    ) {

      nearestDistanceSquared =
        distanceSquared;


      nearestNote =
        note;

    }

  }



  // ---------------------------------
  // 音符の判定範囲外なら「音符なし」
  // ---------------------------------

  if (
    !nearestNote ||
    nearestDistanceSquared >
    hitRadiusSquared
  ) {


    /*
      いったん音符の範囲外へ
      指が出た場合は、

      「最後に鳴らした音符」

      の記憶を解除する。


      これによって、

      音符13
        ↓
      音符のない場所
        ↓
      音符13

      と戻った場合には、

      同じ音符13でも
      もう一度鳴らすことができる。
    */

    lastPlayedNote =
      null;


    return;

  }



  // ---------------------------------
  // 同じ音符の中なら鳴らし直さない
  // ---------------------------------

  if (
    nearestNote ===
    lastPlayedNote
  ) {


    /*
      pointermoveは、

      指を少し動かしただけでも
      何度も発生する。


      そのたびに音を鳴らすと、

      13
      13
      13
      13
      13...

      のように同じ音が
      激しく連打されてしまう。


      そのため、

      前回と同じ音符なら
      何もしない。
    */

    return;

  }



  // ---------------------------------
  // 今回の音符を記憶
  // ---------------------------------

  /*
    音を鳴らす前に記憶しておく。

    このあとpointermoveが
    続けて発生しても、

    同じ音符なら
    上の判定で止められる。
  */

  lastPlayedNote =
    nearestNote;



  // ---------------------------------
  // キー変更を音程に反映
  // ---------------------------------

  const shiftedFrequency =

    nearestNote.frequency *
    keyMultiplier;



  // ---------------------------------
  // 音を最優先で再生
  // ---------------------------------

  playSound(
    shiftedFrequency
  );



  // ---------------------------------
  // 現在位置を光らせる
  // ---------------------------------

  /*
    タップ時だけでなく、

    スライドして
    新しい音符へ入ったときにも
    光る。
  */

  flash(
    displayX,
    displayY
  );

}



// =====================================
// 押した瞬間
// =====================================

image.addEventListener(
  "pointerdown",

  async function(event) {


    // ---------------------------------
    // AudioContext確認
    // ---------------------------------

    /*
      iPhoneなどで
      バックグラウンドから
      復帰した場合も考慮する。


      pointerdownという

      「明確なユーザー操作」

      の中でAudioContextを
      使用可能な状態にする。


      ここは従来の
      iPhone対策をそのまま維持。
    */

    await ensureAudioContext();



    // ---------------------------------
    // スライド演奏開始
    // ---------------------------------

    isPointerPlaying =
      true;



    /*
      今押された指・マウスの
      pointerIdを記憶する。
    */

    activePointerId =
      event.pointerId;



    /*
      新しい演奏が始まったので、

      「最後に鳴らした音符」

      の記憶をリセットする。
    */

    lastPlayedNote =
      null;



    // ---------------------------------
    // Pointer Capture
    // ---------------------------------

    /*
      Pointer Captureを使うと、

      指やマウスが画像の外へ
      少し出た場合でも、

      pointermove
      pointerup

      をこの画像が
      受け取り続けられる。


      スライド操作を
      安定させるための処理。
    */

    try {

      image.setPointerCapture(
        event.pointerId
      );

    }

    catch (error) {


      /*
        Pointer Captureが
        使用できない環境でも、

        通常のタップ演奏自体は
        続けることができる。


        そのため、
        エラーになっても
        アプリ全体は停止させない。
      */

      console.warn(
        "Pointer Captureを開始できませんでした。",
        error
      );

    }



    // ---------------------------------
    // 押した位置の音符を鳴らす
    // ---------------------------------

    /*
      ここで従来の

      「押した瞬間に鳴る」

      動作も維持する。
    */

    playNoteAtPointer(
      event
    );

  }

);



// =====================================
// 押したまま移動
// =====================================

image.addEventListener(
  "pointermove",

  function(event) {


    // ---------------------------------
    // 演奏中でなければ何もしない
    // ---------------------------------

    /*
      pointermoveは、

      指を押していない状態の
      マウス移動などでも
      発生することがある。


      pointerdownから始まった
      演奏中だけ処理する。
    */

    if (
      !isPointerPlaying
    ) {

      return;

    }



    // ---------------------------------
    // 最初に押したpointerだけを使う
    // ---------------------------------

    /*
      スマホでは複数の指を
      同時に置ける。


      今回は、

      pointerdownした
      最初の指だけを

      演奏用として扱う。
    */

    if (
      event.pointerId !==
      activePointerId
    ) {

      return;

    }



    // ---------------------------------
    // 現在位置の音符を判定
    // ---------------------------------

    /*
      指を動かすたびに、

      現在位置にある音符を調べる。


      ただし、

      playNoteAtPointer()

      の中で前回の音符と
      比較しているため、

      同じ音符の中では
      何度も鳴らない。
    */

    playNoteAtPointer(
      event
    );

  }

);



// =====================================
// スライド演奏終了
// =====================================

function finishPointerPlaying(
  event
) {


  // ---------------------------------
  // 別のpointerなら無視
  // ---------------------------------

  if (
    event.pointerId !==
    activePointerId
  ) {

    return;

  }



  // ---------------------------------
  // 演奏状態を解除
  // ---------------------------------

  isPointerPlaying =
    false;


  activePointerId =
    null;


  lastPlayedNote =
    null;

}



// =====================================
// 指・マウスを離した
// =====================================

image.addEventListener(
  "pointerup",

  finishPointerPlaying
);



// =====================================
// pointer操作が中断された
// =====================================

image.addEventListener(
  "pointercancel",

  finishPointerPlaying
);



/*
  pointercancelは、

  ブラウザやOS側の都合などで
  pointer操作が途中終了した場合に
  発生する。


  pointerupだけに頼らず
  こちらにも対応しておくことで、

  「演奏中のままになってしまう」

  事故を防ぐ。
*/



// =====================================
// Pointer Captureが失われた場合
// =====================================

image.addEventListener(
  "lostpointercapture",

  function(event) {


    /*
      何らかの理由で
      Pointer Captureが解除された場合も、

      演奏状態をリセットする。
    */

    if (
      event.pointerId ===
      activePointerId
    ) {

      isPointerPlaying =
        false;


      activePointerId =
        null;


      lastPlayedNote =
        null;

    }

  }

);