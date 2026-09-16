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


const keyPressMarker =
  document.getElementById(
    "keyPressMarker"
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
// iPhoneの実際に見えている画面高を反映
// =====================================

function updateAppHeight() {

  const viewport =
    window.visualViewport;


  /*
    ピンチ操作中の拡大・縮小は対象にしない。
    画面の回転やSafariの表示領域変化だけを反映する。
  */
  if (
    viewport &&
    viewport.scale !== 1
  ) {

    return;

  }


  const height =
    viewport
      ? viewport.height
      : window.innerHeight;


  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.round(height)}px`
  );

}



function updateAppHeightAfterRotation() {

  updateAppHeight();


  /* iPhoneは回転直後にも高さが変わるため、次の描画後にも測り直す */
  requestAnimationFrame(
    () => {

      requestAnimationFrame(
        updateAppHeight
      );

    }
  );

}



updateAppHeightAfterRotation();



window.addEventListener(
  "resize",
  updateAppHeightAfterRotation
);



window.addEventListener(
  "orientationchange",
  updateAppHeightAfterRotation
);



if (
  window.visualViewport
) {

  window.visualViewport.addEventListener(
    "resize",
    updateAppHeightAfterRotation
  );

}



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
      audioContext &&
      audioContext.state ===
        "running"
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


      AudioContextがなければ新しく作成し、
      suspendedまたはinterruptedならresume()で再開する。
    */

    ensureAudioContext()

      .then(
        function() {


          // ----------------------------------
          // 音声準備成功
          // ----------------------------------

          if (
            audioContext.state ===
              "running"
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

          AudioContextがrunningでなければ、
          ユーザーへ
          もう一度タップしてもらう。
        */

        if (
          !audioContext ||
          audioContext.state !==
            "running"
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


        この時点で古いAudioContextを終了して参照を外す。
        次回の演奏操作では新しいAudioContextを作成する。
      */



      // 押し続けている音も、画面を離れた時点で確実に止める。
      stopSound();


      hideKeyPress();


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


  // 新しい鍵へ移ったときは、前の持続音を滑らかに消す。
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
    0.02秒で穏やかに立ち上げる。

    鋭すぎる立ち上がりを避けて、ブザーのように持続しても
    耳に刺さりにくい音にする。
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



  // ---------------------------------
  // 持続音の終了
  // ---------------------------------

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


      /*
        指を離した瞬間に音を切らず、約60msかけて消す。
        クリックノイズを防ぎ、琴らしい余韻を少し残す。
      */
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


  /*
    弦を弾いた瞬間の成分だけは従来どおり短く終える。
    押している間は基音と倍音が鳴り続ける。
  */
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
  指やマウスを押したまま
  鍵の上を移動すると、

  鍵が切り替わった瞬間に
  次の音を鳴らす。


  たとえば、

  鍵13
    ↓
  鍵14
    ↓
  鍵15

  と指を滑らせると、

  13 → 14 → 15

  と順番に音が鳴る。


  同じ鍵の上を動いているだけでは
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


/*
  現在、押下表示を出している音符。
  画面サイズが変わった場合にも位置を計算し直せるように保持する。
*/
let pressedNote =
  null;

// 音符データと同じファイルにまとめた、鍵盤画像の対応情報を使用する。
const {
  blackKeyAreas,
  nonPlayableBlackKeyAreas,
  whiteKeyAreas,
  blackKeyBottomRatio,
  keyboardTopRatio,
  keyboardBottomRatio
} = keyboardLayout;


const pressMaskBlackKeyAreas = [
  ...blackKeyAreas,
  ...nonPlayableBlackKeyAreas
];


function validateKeyboardImageDimensions() {

  if (
    image.naturalWidth !== keyboardLayout.imageWidth ||
    image.naturalHeight !== keyboardLayout.imageHeight
  ) {

    console.error(
      "鍵盤画像の寸法が鍵判定データと一致しません。",
      {
        expected: `${keyboardLayout.imageWidth}x${keyboardLayout.imageHeight}`,
        actual: `${image.naturalWidth}x${image.naturalHeight}`
      }
    );

  }

}


if (
  image.complete
) {

  validateKeyboardImageDimensions();

}

else {

  image.addEventListener(
    "load",
    validateKeyboardImageDimensions,
    { once: true }
  );

}


function findNoteAtKey(
  pointerX,
  pointerY
) {

  // 黒鍵は白鍵の上に重なっているので、先に判定する。
  if (
    pointerY >= keyboardTopRatio &&
    pointerY <= blackKeyBottomRatio
  ) {

    for (
      const note
      of notes
    ) {

      if (
        note.keyType !== "black"
      ) {

        continue;

      }


      const area =
        blackKeyAreas[
          note.keyIndex
        ];


      if (
        pointerX >= area.left &&
        pointerX <= area.right
      ) {

        return note;

      }

    }

  }


  // 黒鍵以外の位置は、対応する白鍵を鳴らす。
  if (
    pointerY < keyboardTopRatio ||
    pointerY > keyboardBottomRatio
  ) {

    return null;

  }


  for (
    const note
    of notes
  ) {

    if (
      note.keyType !== "white"
    ) {

      continue;

    }


    const area =
      whiteKeyAreas[
        note.keyIndex
      ];


    if (
      pointerX >= area.left &&
      pointerX <= area.right
    ) {

      return note;

    }

  }


  return null;

}


// =====================================
// 鍵の押下表示
// =====================================

function showKeyPress(
  note
) {


  const keyArea =
    note.keyType === "black"
      ? blackKeyAreas[note.keyIndex]
      : whiteKeyAreas[note.keyIndex];


  if (
    !keyArea ||
    !image.clientWidth ||
    !image.clientHeight
  ) {

    return;

  }


  const topRatio =
    keyboardTopRatio;


  const bottomRatio =
    note.keyType === "black"
      ? blackKeyBottomRatio
      : keyboardBottomRatio;


  keyPressMarker.style.left =
    `${keyArea.left * image.clientWidth}px`;


  keyPressMarker.style.top =
    `${topRatio * image.clientHeight}px`;


  keyPressMarker.style.width =
    `${(keyArea.right - keyArea.left) * image.clientWidth}px`;


  keyPressMarker.style.height =
    `${(bottomRatio - topRatio) * image.clientHeight}px`;



  if (
    note.keyType === "white"
  ) {

    /*
      白鍵の上部は黒鍵と重なっている。
      その範囲を切り欠いて、白鍵を押したときに黒鍵まで
      金色に光らないようにする。
    */
    let leftCut =
      0;


    let rightCut =
      100;


    const keyWidth =
      keyArea.right -
      keyArea.left;


    for (
      const blackKeyArea
      of pressMaskBlackKeyAreas
    ) {

      const overlapLeft =
        Math.max(
          keyArea.left,
          blackKeyArea.left
        );


      const overlapRight =
        Math.min(
          keyArea.right,
          blackKeyArea.right
        );


      if (
        overlapLeft >=
        overlapRight
      ) {

        continue;

      }


      const localLeft =
        (overlapLeft - keyArea.left) /
        keyWidth * 100;


      const localRight =
        (overlapRight - keyArea.left) /
        keyWidth * 100;


      if (
        localLeft <= 0.01
      ) {

        leftCut =
          Math.max(
            leftCut,
            localRight
          );

      }


      if (
        localRight >= 99.99
      ) {

        rightCut =
          Math.min(
            rightCut,
            localLeft
          );

      }

    }


    const blackKeyBottom =
      (blackKeyBottomRatio - topRatio) /
      (bottomRatio - topRatio) * 100;


    const clipPath =
      `polygon(${leftCut}% 0%, ${rightCut}% 0%, ` +
      `${rightCut}% ${blackKeyBottom}%, 100% ${blackKeyBottom}%, ` +
      `100% 100%, 0% 100%, 0% ${blackKeyBottom}%, ` +
      `${leftCut}% ${blackKeyBottom}%)`;


    keyPressMarker.style.clipPath =
      clipPath;


    keyPressMarker.style.webkitClipPath =
      clipPath;

  }

  else {

    keyPressMarker.style.clipPath =
      "none";


    keyPressMarker.style.webkitClipPath =
      "none";

  }


  keyPressMarker.className =
    note.keyType === "black"
      ? "is-visible is-black"
      : "is-visible is-white";


  pressedNote =
    note;

}



function hideKeyPress() {


  keyPressMarker.className =
    "";


  pressedNote =
    null;

}



function refreshKeyPress() {


  if (
    pressedNote
  ) {

    showKeyPress(
      pressedNote
    );

  }

}



window.addEventListener(
  "resize",

  function() {

    requestAnimationFrame(
      refreshKeyPress
    );

  }
);



// =====================================
// 指定位置の鍵を探して鳴らす
// =====================================

function playNoteAtPointer(
  event
) {


  // ---------------------------------
  // 表示画像上の座標
  // ---------------------------------

  /*
    offsetX / offsetYは、イベントを受け取った画像自身を基準にした
    座標である。

    縦持ち時はアプリ全体をCSSで回転しているが、画面全体を基準とする
    clientX / clientYではなく、この画像内の座標を使うことで、
    回転の向きに関係なく横向け時と同じ鍵を判定できる。
  */
  const displayX =
    event.offsetX;


  const displayY =
    event.offsetY;



  // ---------------------------------
  // 0～1の比率座標に変換
  // ---------------------------------

  const pointerX =
    displayX /
    image.clientWidth;


  const pointerY =
    displayY /
    image.clientHeight;



  const selectedNote =
    findNoteAtKey(
      pointerX,
      pointerY
    );


  if (
    !selectedNote
  ) {

    // 鍵盤の外へ出たら、押したままでも音を止める。
    stopSound();

    hideKeyPress();

    lastPlayedNote =
      null;


    return;

  }



  // ---------------------------------
  // 同じ音符の中なら鳴らし直さない
  // ---------------------------------

  if (
    selectedNote ===
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
  // 今回の鍵を記憶
  // ---------------------------------

  /*
    音を鳴らす前に記憶しておく。

    このあとpointermoveが
    続けて発生しても、

    同じ音符なら
    上の判定で止められる。
  */

  lastPlayedNote =
    selectedNote;



  // ---------------------------------
  // キー変更を音程に反映
  // ---------------------------------

  const shiftedFrequency =

    selectedNote.frequency *
    keyMultiplier;



  // ---------------------------------
  // 音を最優先で再生
  // ---------------------------------

  playSound(
    shiftedFrequency
  );


  // 鳴らしている鍵を、画像上でも押された状態にする。
  showKeyPress(
    selectedNote
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
      iPhone Safariなどの長押し時に出る画像の呼び出し・選択用の
      既定操作を止め、鍵を押し続ける演奏操作として扱う。
    */
    event.preventDefault();


    // ---------------------------------
    // 最初に押したpointerだけを使う
    // ---------------------------------

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

      if (
        event.pointerId === activePointerId
      ) {

        isPointerPlaying =
          false;


        activePointerId =
          null;

      }

      console.warn(
        "AudioContextの準備に失敗しました。",
        error
      );


      audioStartMessage.textContent =
        "もう一度タップしてください";


      audioStartOverlay.style.display =
        "flex";


      return;

    }


    /*
      音声準備中に指が離された場合は、
      終了済みのpointerを演奏に使わない。
    */

    if (
      event.pointerId !== activePointerId
    ) {

      return;

    }


    isPointerPlaying =
      true;



    // ---------------------------------
    // スライド演奏開始
    // ---------------------------------

    /*
      pointerdownが発生したので、

      ここから指またはマウスによる
      スライド演奏を開始する。

    */

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



// 長押し・右クリックによる画像メニューも鍵盤上では表示しない。
image.addEventListener(
  "contextmenu",

  function(event) {

    event.preventDefault();

  }
);



/*
  iOSのルーペはPointer Eventではなく、長押し開始時のTouch Eventから
  起動することがある。非パッシブで既定操作を止め、選択ルーペを出さない。
  演奏に使うPointer Eventはこの後も通常どおり受け取る。
*/
image.addEventListener(
  "touchstart",

  function(event) {

    event.preventDefault();

  },

  {
    passive: false
  }
);



/*
  Safariは最初のタップ終了後に、次の長押しをダブルタップ操作として
  判定することがある。touchendも止めて、鍵盤ではこの既定操作を
  成立させない。
*/
image.addEventListener(
  "touchend",

  function(event) {

    event.preventDefault();

  },

  {
    passive: false
  }
);



// Safari固有の拡大ジェスチャーも鍵盤上では使わせない。
for (
  const eventName
  of [
    "gesturestart",
    "gesturechange",
    "gestureend",
    "dblclick"
  ]
) {

  image.addEventListener(
    eventName,

    function(event) {

      event.preventDefault();

    }
  );

}



// 選択開始イベントが発生した場合にも、鍵盤上では選択させない。
image.addEventListener(
  "selectstart",

  function(event) {

    event.preventDefault();

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

function resetPointerPlaying() {

  // 指・マウスを離したら、持続音を滑らかに止める。
  stopSound();


  hideKeyPress();


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
  Pointer Captureを開始できなかった場合でも、画像外で指やマウスを
  離したことを検出し、持続音が残らないようにする。
  画像上の終了イベントはwindowへも伝わるが、2回目はID判定で無視される。
*/
window.addEventListener(
  "pointerup",
  finishPointerPlaying
);


window.addEventListener(
  "pointercancel",
  finishPointerPlaying
);


// ブラウザ外で離された場合にも、ウィンドウの失焦時に演奏状態を解除する。
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


function isInfoDialogOpen() {

  return infoOverlay.getAttribute(
    "aria-hidden"
  ) === "false";

}



// -------------------------------------
// アプリ情報を開く
// -------------------------------------

function openInfoDialog() {

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
// PCではEscapeで閉じ、Tabキーの移動をダイアログ内に限定する
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
