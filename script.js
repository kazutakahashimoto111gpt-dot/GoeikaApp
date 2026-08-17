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



// ============================================
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

  「次に音符をタップしたときに
   AudioContextを作り直す必要があるか」

  を記憶するためのもの。


  false
    ↓
  作り直す必要なし


  true
    ↓
  次のタップ時に作り直す


  という意味。
*/



// ============================================
// アプリがバックグラウンドへ移動したことを検出
// ============================================

document.addEventListener(
  "visibilitychange",

  function() {


    /*
      visibilityStateが

      hidden

      になった場合、

      このページが画面から見えなくなった
      ということ。


      たとえば、

      ・ホーム画面へ戻った
      ・別のアプリへ切り替えた
      ・ブラウザの別タブへ移動した

      など。
    */

    if (
      document.visibilityState ===
      "hidden"
    ) {


      /*
        iPhoneなどでは、

        バックグラウンドへ移動したあと
        AudioContextが正常に復帰しないことがある。


        しかも場合によっては

        audioContext.state

        が

        "running"

        になっていても、
        実際には音が出ない可能性がある。


        そこで、

        「バックグラウンドへ行った」

        という事実そのものを記録しておく。
      */

      audioContextNeedsReset =
        true;

    }


  }
);



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

      次のユーザー操作（音符タップ）のときに
      新しいAudioContextへ交換する。


      AudioContextの再作成を
      pointerdownの中から行うため、

      iPhoneが要求する

      「ユーザー操作をきっかけに音声を開始する」

      という条件にも合わせやすい。
    */


    // ----------------------------------------
    // 古いAudioContextを終了させる
    // ----------------------------------------

    try {


      /*
        まだclosedでなければ
        close()を試す。
      */

      if (
        audioContext.state !==
        "closed"
      ) {

        await audioContext.close();

      }


    }
    catch (error) {


      /*
        iPhoneなどでclose()が
        何らかの理由で失敗しても、

        アプリ全体を停止させない。


        今回の目的は

        「古いAudioContextを捨てて
         新しいものを使う」

        ことなので、

        close()の失敗そのものは
        致命的ではない。
      */

      console.warn(
        "AudioContextを終了できませんでした。",
        error
      );

    }



    // ----------------------------------------
    // 新しいAudioContextを作成
    // ----------------------------------------

    audioContext =
      new AudioContextClass();



    // ----------------------------------------
    // 再作成フラグを解除
    // ----------------------------------------

    audioContextNeedsReset =
      false;

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

      そのため新しいものを作る。
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


      この関数は音符をタップした
      pointerdownから呼ばれるので、

      ユーザー操作をきっかけに
      resume()することになる。
    */

    await audioContext.resume();

  }

}



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
// 画像タップ時の処理
// =====================================

/*
  【現在の処理の流れ】

  pointerdown
      ↓
  AudioContext確認
      ↓
  必要ならAudioContextを再作成
      ↓
  座標取得
      ↓
  一番近い音符を探す
      ↓
  音を鳴らす
      ↓
  光らせる
*/

image.addEventListener(
  "pointerdown",

  async function(event) {


    // ---------------------------------
    // AudioContext確認
    // ---------------------------------

    /*
      【重要】

      今回はstateがrunningの場合でも
      ensureAudioContext()を呼ぶ。


      なぜなら、

      iPhoneなどでは
      バックグラウンドから戻ったあと、

      stateがrunningでも
      実際には音が出ない可能性を
     考慮するため。


      ensureAudioContext()の中で

      audioContextNeedsReset

      も確認している。
    */

    await ensureAudioContext();



    // ---------------------------------
    // 現在表示中の画像位置・サイズ
    // ---------------------------------

    const rect =
      image.getBoundingClientRect();



    // ---------------------------------
    // 表示画像上のタップ座標
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

    const clickX =
      displayX /
      rect.width;


    const clickY =
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
        clickX -
        note.xRatio;


      // Y方向の差

      const dy =
        clickY -
        note.yRatio;


      /*
        【レスポンス改善】

        本来の距離は

        √(dx² + dy²)

        だが、

        一番近い音符を探すだけなら
        √を計算する必要はない。

        dx² + dy²

        の大小関係だけで
        同じ結果になる。
      */

      const distanceSquared =
        dx * dx +
        dy * dy;


      /*
        今まで見つけた音符より
        今回の音符のほうが近ければ更新する。
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
    // 音符の範囲内なら音を鳴らす
    // ---------------------------------

    /*
      hitRadiusSquaredも
      あらかじめ計算してあるので

      ここでも平方根は不要。
    */

    if (
      nearestNote &&
      nearestDistanceSquared <=
      hitRadiusSquared
    ) {


      // ---------------------------------
      // キー変更を音程に反映
      // ---------------------------------

      /*
        keyMultiplierは
        キー変更時に計算済み。

        ここでは単純な掛け算だけ行う。
      */

      const shiftedFrequency =

        nearestNote.frequency *
        keyMultiplier;



      // ---------------------------------
      // 音を最優先で再生
      // ---------------------------------

      /*
        見た目の処理より先に
        音の再生処理を開始する。
      */

      playSound(
        shiftedFrequency
      );



      // ---------------------------------
      // タップ位置を光らせる
      // ---------------------------------

      /*
        音の再生処理を開始してから
        見た目の処理を行う。
      */

      flash(
        displayX,
        displayY
      );

    }


  }
);