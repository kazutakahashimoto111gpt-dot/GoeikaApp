// =====================================
// HTML要素をjsのオブジェクトとして取得
// =====================================

const image =
  document.getElementById(
    "noteImage"
  );


// =====================================
// 縦画面を回転して表示しているか
// =====================================

/*
  CSSの横向きスマホ用メディアクエリと
  同じ条件を使う。

  画面を回転しているときは、
  タップ座標も縦画面の座標へ戻してから
  音符を判定する必要がある。
*/

const portraitRotationMediaQuery =
  window.matchMedia(
    "(orientation: landscape) and (pointer: coarse)"
  );



function isPortraitAppRotated() {

  return portraitRotationMediaQuery.matches;

}


const flashMarker =
  document.getElementById(
    "flashMarker"
  );


const notePressMarker =
  document.getElementById(
    "notePressMarker"
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
// 連続タップ時のブラウザ標準拡大を抑止
// =====================================

/*
  touch-actionとviewport設定を解釈しない環境でも、
  dblclickをページ拡大へ使わせない。
*/
document.addEventListener(
  "dblclick",

  function(event) {

    event.preventDefault();

  },

  {
    capture: true
  }
);



// =====================================
// タップ判定の余白
// =====================================

/*
  鍵盤そのものの幅に加える余白。

  実際の鍵盤は細長いため、中心からの円判定では
  長い鍵盤の端をタップすると反応しにくくなる。
  この値は、鍵盤の中心線の周りに作る
  カプセル形判定の半径として使う。
*/

const minimumHitRadius =
  30;


const hitRadiusRatio =
  0.03;



// =====================================
// キー設定
// =====================================

function loadKeyShift() {

  try {

    const storedValue =
      localStorage.getItem(
        "kongoKeyShift"
      );


    if (
      storedValue === null
    ) {

      return 0;

    }


    const parsedValue =
      Number(storedValue);


    return Number.isInteger(parsedValue)
      ? parsedValue
      : 0;

  }

  catch (error) {

    console.warn(
      "キー設定を読み込めませんでした。",
      error
    );


    return 0;

  }

}


let keyShift =
  loadKeyShift();



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

  try {

    localStorage.setItem(
      "kongoKeyShift",
      keyShift
    );

  }

  catch (error) {

    console.warn(
      "キー設定を保存できませんでした。",
      error
    );

  }

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
// AudioContext
// --------------------------------------------

/*
  起動直後には、まだAudioContextを作らない。

  iPhone / iPadなどでは、
  ユーザー操作より前にAudioContextを作ると、
  まれに音声開始が不安定になる場合がある。

  そこで最初のユーザー操作時に
  ensureAudioContext() の中で作成する。
*/

let audioContext =
  null;


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

  // audioContext.state : 現在のAudioContextの状態を表します。

  // 代表的な状態は以下の通りです。

  // "running"      → 正常に動いている
  // "suspended"    → 一時停止している
  // "interrupted"  → OSなどによって中断されている
  // "closed"       → 終了している
// ============================================

async function ensureAudioContext() {


  // ------------------------------------------
  // AudioContextがまだ無い場合
  // ------------------------------------------

  if (
    !audioContext
  ) {

    /*
      初回のユーザー操作の中で
      AudioContextを初めて作成する。

      起動時に先回りして作るより、
      iPhone / iPadなどで
      音声開始が安定しやすい。
    */

    audioContext =
      new AudioContextClass();

  }



  // ------------------------------------------
  // バックグラウンドから復帰した場合
  // ------------------------------------------

  if (
    audioContextNeedsReset
  ) {

    /*
      古いAudioContextをそのまま信用せず、
      ユーザー操作中に
      新しいAudioContextへ交換する。

      フラグは先に解除して、
      連続タップで二重に
      作り直されにくくする。
    */

    audioContextNeedsReset =
      false;



    // 古いAudioContextを退避

    const oldAudioContext =
      audioContext;



    // 新しいAudioContextを作成

    audioContext =
      new AudioContextClass();



    // 古いAudioContextを終了

    if (
      oldAudioContext &&
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
      resume()では復活できないので、
      新しく作り直す。
    */

    audioContext =
      new AudioContextClass();

  }



  // ------------------------------------------
  // suspended / interrupted なら再開
  // ------------------------------------------

  if (
    audioContext.state ===
      "suspended" ||
    audioContext.state ===
      "interrupted"
  ) {

    await audioContext.resume();

  }


  // ------------------------------------------
  // 最終確認
  // ------------------------------------------

  /*
    resume()がエラーにならなくても、

    実際にはAudioContextが
    runningになっていない可能性がある。

    その状態でplaySound()へ進むと、

    「エフェクトは表示されるが
      音が鳴らない」

    という状態になる可能性がある。

    そこで発音前に
    本当にrunningなのか確認する。
  */

  if (
    audioContext.state !==
      "running"
  ) {

    throw new Error(
      "AudioContextがrunningになっていません。state=" +
      audioContext.state
    );

  }

  // この関数全体ensureAudioContext()が別のところで、

  // try {
  //   await ensureAudioContext();
  // } catch (error) {
  //   // AudioContextを作り直す等
  // }

  // のように呼ばれているなら、catch に処理を渡すために、ここで throw しているわけです。
  // なので throw は単なる「コンソールにエラーを表示する」より強いです。
  // 「これは正常に処理を続けられる状態じゃないぞ。エラーとして扱ってくれ」
  // と、その場の通常処理を中断して、エラー処理側へ渡すものです。

}



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


      // 画面を離れた時点で、持続音と押下表示を解除する。
      stopSound();

      hideNotePress();


      /*
        visibilityStateが

        hidden

        になったということは、


        ・ホーム画面へ戻った

        ・別のアプリへ切り替えた

        ・画面を閉じた

        ・ブラウザの別タブへ移動した


        などの可能性がある。


        今回はこの時点で、

        使用中のAudioContextを
        完全に終了する。


        従来はここで

        audioContextNeedsReset = true;

        として、

        復帰後のユーザー操作時に
        AudioContextを交換していた。


        今回は、

        画面から見えなくなった時点で
        古いAudioContextを終了し、

        次回は完全に新しい
        AudioContextを作る方式にする。
      */



      // --------------------------------------
      // 現在のAudioContextを退避
      // --------------------------------------

      const oldAudioContext =
        audioContext;



      // --------------------------------------
      // 現在のAudioContextへの参照を解除
      // --------------------------------------

      /*
        close()は非同期処理なので、

        終了完了を待つより先に
        audioContextをnullにする。


        これによって、

        これ以降アプリ側では
        古いAudioContextを

        現役のAudioContextとして
        扱わない。
      */

      audioContext =
        null;



      // --------------------------------------
      // 再作成フラグも解除
      // --------------------------------------

      /*
        今回は古いAudioContextそのものを
        ここで終了するので、

        従来の

        「あとで作り直す必要がある」

        というフラグは必要ない。


        falseにしておくことで、

        次回ensureAudioContext()が
        呼ばれたとき、

        audioContext === null

        の判定によって
        新しいAudioContextが

        1個だけ作成される。
      */

      audioContextNeedsReset =
        false;



      // --------------------------------------
      // 古いAudioContextを終了
      // --------------------------------------

      if (
        oldAudioContext &&
        oldAudioContext.state !==
          "closed"
      ) {

        oldAudioContext.close()
          .catch(
            function(error) {

              /*
                close()に失敗した場合でも、

                audioContext変数からは
                すでに切り離してある。


                そのため、

                次回アプリを使用するときは
                新しいAudioContextを

                作成することができる。
              */

              console.warn(
                "AudioContextを終了できませんでした。",
                error
              );

            }
          );

      }



      // --------------------------------------
      // スライド演奏状態も解除
      // --------------------------------------

      /*
        演奏中にアプリを閉じた場合に、

        pointerの状態だけが
        残ってしまわないようにする。
      */

      isPointerPlaying =
        false;


      activePointerId =
        null;


      lastPlayedNote =
        null;

    }
  }
);



// =====================================
// 琴風サウンド
// =====================================

/*
  現在鳴っている持続音。
  新しい音符へ移動したとき、または指を離したときに
  短いリリースをかけて停止する。
*/

let activeSound =
  null;



function stopSound() {

  if (
    !activeSound
  ) {

    return;

  }


  const soundToStop =
    activeSound;


  activeSound =
    null;


  soundToStop.stop();

}

function playSound(
  frequency
) {


  // 新しい区間へ入ったときは、前の持続音を滑らかに消す。
  stopSound();


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
    持続音でも耳に刺さりにくいよう、
    0.02秒で穏やかに立ち上げる。
  */

  masterGain.gain
    .exponentialRampToValueAtTime(
      0.38,
      now + 0.02
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



  /*
    基音と倍音は、指を離すまで鳴らし続ける。
    停止時は短いリリースでクリックノイズを防ぐ。
  */

  let hasStopped =
    false;


  activeSound = {

    stop() {

      if (
        hasStopped
      ) {

        return;

      }


      hasStopped =
        true;


      const releaseTime =
        audioContext.currentTime;


      masterGain.gain.cancelScheduledValues(
        releaseTime
      );


      masterGain.gain.setTargetAtTime(
        0.0001,
        releaseTime,
        0.02
      );


      osc1.stop(
        releaseTime + 0.12
      );


      osc2.stop(
        releaseTime + 0.12
      );


      osc3.stop(
        releaseTime + 0.12
      );

    }

  };


  // 弦を弾いた瞬間の成分だけは短く終える。
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
// 音符の押下表示
// =====================================

/*
  渦巻き画像の25区間それぞれについて、
  押下表示用の長さと角度を定義する。

  座標の中心はnotes.jsのxRatio / yRatioを使い、
  この情報は金色のオーバーレイを区間に沿わせるためだけに使う。
*/

const notePressLayouts = [
  { lengthRatio: 0.097, angle: 90 },
  { lengthRatio: 0.095, angle: 90 },
  { lengthRatio: 0.110, angle: -45 },
  { lengthRatio: 0.091, angle: -45 },
  { lengthRatio: 0.114, angle: 0 },
  { lengthRatio: 0.142, angle: 0 },
  { lengthRatio: 0.145, angle: 45 },
  { lengthRatio: 0.112, angle: 45 },
  { lengthRatio: 0.152, angle: 90 },
  { lengthRatio: 0.138, angle: 90 },
  { lengthRatio: 0.115, angle: -45 },
  { lengthRatio: 0.149, angle: -45 },
  { lengthRatio: 0.144, angle: 0 },
  { lengthRatio: 0.132, angle: 0 },
  { lengthRatio: 0.138, angle: 45 },
  { lengthRatio: 0.127, angle: 45 },
  { lengthRatio: 0.192, angle: 90 },
  { lengthRatio: 0.144, angle: 90 },
  { lengthRatio: 0.206, angle: -45 },
  { lengthRatio: 0.153, angle: -45 },
  { lengthRatio: 0.172, angle: 0 },
  { lengthRatio: 0.184, angle: 0 },
  { lengthRatio: 0.172, angle: 45 },
  { lengthRatio: 0.153, angle: 45 },
  { lengthRatio: 0.188, angle: 90 }
];



// =====================================
// 鍵盤のカプセル形タップ判定
// =====================================

/*
  鍵盤の中心線上で、タップ地点にもっとも近い点を探す。
  中心線の両端に丸みを加えたカプセル形にすることで、
  鍵盤の端も押しやすくしつつ余白の誤反応を抑える。
*/

function getNoteHitDistanceSquared(
  note,
  pointerX,
  pointerY,
  imageWidth,
  imageHeight
) {

  const layout =
    notePressLayouts[
      note.no - 1
    ];


  if (!layout) {

    return Infinity;

  }


  const centerX =
    note.xRatio * imageWidth;


  const centerY =
    note.yRatio * imageHeight;


  const angleRadians =
    layout.angle * Math.PI / 180;


  const directionX =
    Math.cos(angleRadians);


  const directionY =
    Math.sin(angleRadians);


  const halfLength =
    layout.lengthRatio * imageWidth / 2;


  const offsetX =
    pointerX - centerX;


  const offsetY =
    pointerY - centerY;


  const projectedLength =
    offsetX * directionX +
    offsetY * directionY;


  const clampedLength =
    Math.max(
      -halfLength,
      Math.min(halfLength, projectedLength)
    );


  const nearestX =
    centerX +
    directionX * clampedLength;


  const nearestY =
    centerY +
    directionY * clampedLength;


  const distanceX =
    pointerX - nearestX;


  const distanceY =
    pointerY - nearestY;


  return (
    distanceX * distanceX +
    distanceY * distanceY
  );

}



let pressedNote =
  null;



function showNotePress(
  note
) {

  const layout =
    notePressLayouts[
      note.no - 1
    ];


  if (
    !layout ||
    !image.offsetWidth ||
    !image.offsetHeight
  ) {

    return;

  }


  notePressMarker.style.left =
    `${note.xRatio * image.offsetWidth}px`;


  notePressMarker.style.top =
    `${note.yRatio * image.offsetHeight}px`;


  notePressMarker.style.width =
    `${layout.lengthRatio * image.offsetWidth}px`;


  notePressMarker.style.height =
    `${Math.max(18, image.offsetWidth * 0.037)}px`;


  notePressMarker.style.setProperty(
    "--note-press-angle",
    `${layout.angle}deg`
  );


  notePressMarker.className =
    note.no % 2 === 0
      ? "is-visible is-white"
      : "is-visible is-black";


  pressedNote =
    note;

}



function hideNotePress() {

  notePressMarker.className =
    "";


  pressedNote =
    null;

}



function refreshNotePress() {

  if (
    pressedNote
  ) {

    showNotePress(
      pressedNote
    );

  }

}



window.addEventListener(
  "resize",

  function() {

    requestAnimationFrame(
      refreshNotePress
    );

  }
);



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
  // 縦画面基準の画像上座標
  // ---------------------------------

  /*
    横向きスマホでは、画面全体を反時計回りに90度
    回転している。

    clientX / clientY は回転後の画面座標なので、
    音符データと同じ縦画面座標へ変換する。
  */

  const imageWidth =
    image.offsetWidth;


  const imageHeight =
    image.offsetHeight;


  let displayX;


  let displayY;


  if (
    isPortraitAppRotated()
  ) {

    displayX =
      imageWidth -
      (
        event.clientY -
        rect.top
      );


    displayY =
      event.clientX -
      rect.left;

  }

  else {

    displayX =
      event.clientX -
      rect.left;


    displayY =
      event.clientY -
      rect.top;

  }



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
  // すべての鍵盤との距離を調べる
  // ---------------------------------

  const hitRadius =
    Math.max(
      minimumHitRadius,
      imageWidth * hitRadiusRatio
    );


  const hitRadiusSquared =
    hitRadius * hitRadius;

  for (
    const note
    of notes
  ) {


    const distanceSquared =
      getNoteHitDistanceSquared(
        note,
        displayX,
        displayY,
        imageWidth,
        imageHeight
      );



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


    // 区間外へ出たら、持続音と押下表示を解除する。
    stopSound();

    hideNotePress();


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


  // 押している区間を金色で表示する。
  showNotePress(
    nearestNote
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


    /*
      長押し時の画像メニューや連続タップ後の拡大を抑制し、
      演奏操作として扱う。
    */
    event.preventDefault();


    if (
      activePointerId !== null &&
      event.pointerId !== activePointerId
    ) {

      return;

    }


    activePointerId =
      event.pointerId;


    lastPlayedNote =
      null;


    // ---------------------------------
    // AudioContext確認
    // ---------------------------------

    try {

      await ensureAudioContext();

    }

    catch (error) {

      console.warn(
        "AudioContextの準備に失敗しました。",
        error
      );


      if (
        event.pointerId === activePointerId
      ) {

        isPointerPlaying =
          false;


        activePointerId =
          null;

      }


      return;

    }



    // ---------------------------------
    // スライド演奏開始
    // ---------------------------------

    /*
      音声初期化中に指が離された場合は、
      すでに終了した操作を演奏として開始しない。
    */
    if (
      event.pointerId !==
      activePointerId
    ) {

      return;

    }

    /*
      pointerdownが発生したので、

      ここから指またはマウスによる
      スライド演奏を開始する。

    */

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



// 演奏画像上では、長押し・画像メニュー・Safari固有の拡大操作を抑制する。
image.addEventListener(
  "contextmenu",

  function(event) {

    event.preventDefault();

  }
);



image.addEventListener(
  "touchstart",

  function(event) {

    event.preventDefault();

  },

  {
    passive: false
  }
);



image.addEventListener(
  "touchend",

  function(event) {

    event.preventDefault();

  },

  {
    passive: false
  }
);



for (
  const eventName
  of [
    "gesturestart",
    "gesturechange",
    "gestureend",
    "dblclick",
    "selectstart"
  ]
) {

  image.addEventListener(
    eventName,

    function(event) {

      event.preventDefault();

    }
  );

}



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

function resetPointerPlaying() {

  // 指・マウスを離したら、持続音と押下表示を解除する。
  stopSound();

  hideNotePress();


  isPointerPlaying =
    false;


  activePointerId =
    null;


  lastPlayedNote =
    null;

}



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



  resetPointerPlaying();

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
  Pointer Captureが使えない環境でも、画像外で離した操作を検出して
  持続音が残らないようにする。
*/
window.addEventListener(
  "pointerup",

  finishPointerPlaying
);



window.addEventListener(
  "pointercancel",

  finishPointerPlaying
);



window.addEventListener(
  "blur",

  resetPointerPlaying
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

      resetPointerPlaying();

    }

  }

);

// =====================================
// アプリ情報ダイアログ
// =====================================

const infoButton =
  document.getElementById(
    "infoButton"
  );


const infoOverlay =
  document.getElementById(
    "infoOverlay"
  );


const infoDialog =
  document.getElementById(
    "infoDialog"
  );


const infoCloseButton =
  document.getElementById(
    "infoCloseButton"
  );


let infoPreviouslyFocusedElement =
  null;


const infoBackgroundElements =
  Array.from(
    infoOverlay.parentElement.children
  ).filter(
    element => element !== infoOverlay
  );


function isInfoDialogOpen() {

  return infoOverlay.getAttribute(
    "aria-hidden"
  ) === "false";

}



// -------------------------------------
// アプリ情報を開く
// -------------------------------------

function openInfoDialog() {

  if (
    isInfoDialogOpen()
  ) {

    return;

  }


  infoPreviouslyFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;


  document.body.classList.add(
    "is-info-open"
  );

  infoOverlay.style.display =
    "flex";


  infoOverlay.setAttribute(
    "aria-hidden",
    "false"
  );


  for (
    const element
    of infoBackgroundElements
  ) {

    element.inert =
      true;

  }


  /*
    閉じるボタンへフォーカスを移し、
    キーボード操作でも扱いやすくする。
  */

  infoCloseButton.focus();

}



// -------------------------------------
// アプリ情報を閉じる
// -------------------------------------

function closeInfoDialog() {

  if (
    !isInfoDialogOpen()
  ) {

    return;

  }

  infoOverlay.style.display =
    "none";


  infoOverlay.setAttribute(
    "aria-hidden",
    "true"
  );


  for (
    const element
    of infoBackgroundElements
  ) {

    element.inert =
      false;

  }


  document.body.classList.remove(
    "is-info-open"
  );


  const focusTarget =
    infoPreviouslyFocusedElement &&
    infoPreviouslyFocusedElement.isConnected
      ? infoPreviouslyFocusedElement
      : infoButton;


  infoPreviouslyFocusedElement =
    null;


  focusTarget.focus();

}



// -------------------------------------
// 情報ボタン
// -------------------------------------

infoButton.addEventListener(
  "click",

  function(event) {

    /*
      情報ボタンの操作を
      演奏用の操作と混同させない。
    */

    event.stopPropagation();


    openInfoDialog();

  }
);



// -------------------------------------
// 閉じるボタン
// -------------------------------------

infoCloseButton.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    closeInfoDialog();

  }
);



// -------------------------------------
// ダイアログの外側を押した場合
// -------------------------------------

infoOverlay.addEventListener(
  "pointerdown",

  function(event) {

    /*
      白いダイアログ部分ではなく、
      背景部分そのものを押したときだけ閉じる。
    */

    if (
      event.target ===
      infoOverlay
    ) {

      closeInfoDialog();

    }

  }
);



// -------------------------------------
// ダイアログ内の操作は外へ伝えない
// -------------------------------------

infoDialog.addEventListener(
  "pointerdown",

  function(event) {

    event.stopPropagation();

  }
);



// -------------------------------------
// Escapeで閉じ、Tabキーの移動をダイアログ内に限定する
// -------------------------------------

document.addEventListener(
  "keydown",

  function(event) {

    if (
      !isInfoDialogOpen()
    ) {

      return;

    }


    if (
      event.key ===
        "Escape"
    ) {

      event.preventDefault();

      closeInfoDialog();


      return;

    }


    if (
      event.key ===
        "Tab"
    ) {

      const focusableElements =
        infoDialog.querySelectorAll(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );


      if (
        focusableElements.length === 0
      ) {

        event.preventDefault();


        return;

      }


      const firstElement =
        focusableElements[0];


      const lastElement =
        focusableElements[
          focusableElements.length - 1
        ];


      if (
        event.shiftKey &&
        document.activeElement === firstElement
      ) {

        event.preventDefault();
        lastElement.focus();

      }

      else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {

        event.preventDefault();
        firstElement.focus();

      }

    }

  }
);
