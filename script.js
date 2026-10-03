const image =
  document.getElementById(
    "noteImage"
  );


// CSSの回転条件とそろえ、タップ座標を縦画面基準へ変換する。
const portraitRotationMediaQuery =
  window.matchMedia(
    "(orientation: landscape) and (pointer: coarse)"
  );



function isPortraitAppRotated() {

  return portraitRotationMediaQuery.matches;

}


// iOS PWAの横画面で負のスクロール位置が残る場合だけ上端へ戻す。
let negativeScrollResetAttempts = 0;
let negativeScrollCheckTimer = null;

function resetNegativePageScroll() {
  if (
    !window.matchMedia("(display-mode: standalone)").matches ||
    window.innerWidth <= window.innerHeight ||
    (window.visualViewport && window.visualViewport.scale !== 1)
  ) {
    return;
  }

  if (window.scrollY >= 0) {
    negativeScrollResetAttempts = 0;
    return;
  }

  if (negativeScrollResetAttempts >= 3) return;

  negativeScrollResetAttempts++;
  window.scrollTo(0, 0);
}

function checkNegativePageScrollAfterDisplayChange() {
  negativeScrollResetAttempts = 0;
  requestAnimationFrame(resetNegativePageScroll);
  window.setTimeout(resetNegativePageScroll, 200);
  window.setTimeout(resetNegativePageScroll, 700);
}

function checkNegativePageScrollAfterScroll() {
  if (negativeScrollCheckTimer !== null) {
    window.clearTimeout(negativeScrollCheckTimer);
  }

  negativeScrollCheckTimer = window.setTimeout(() => {
    negativeScrollCheckTimer = null;
    resetNegativePageScroll();
  }, 80);
}

checkNegativePageScrollAfterDisplayChange();
window.addEventListener("pageshow", checkNegativePageScrollAfterDisplayChange);
window.addEventListener("resize", checkNegativePageScrollAfterDisplayChange);
window.addEventListener("orientationchange", checkNegativePageScrollAfterDisplayChange);
window.addEventListener("scroll", checkNegativePageScrollAfterScroll, { passive: true });
window.visualViewport?.addEventListener(
  "scroll",
  checkNegativePageScrollAfterScroll,
  { passive: true }
);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkNegativePageScrollAfterDisplayChange();
});



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



// touch-actionやviewport設定が効かない環境でも連続タップの拡大を抑止する。
document.addEventListener(
  "dblclick",

  function(event) {

    event.preventDefault();

  },

  {
    capture: true
  }
);



// 細長い鍵盤の端も押しやすいよう、カプセル形判定に余白を持たせる。
const minimumHitRadius =
  30;


const hitRadiusRatio =
  0.03;



// =====================================
// キー設定
// =====================================

function loadKeyShift() {

  try {

    let storedValue =
      localStorage.getItem(
        "goeikaapp:keyShift"
      );

    if (
      storedValue === null
    ) {

      storedValue =
        localStorage.getItem(
          "kongoKeyShift"
        );

      if (
        storedValue !== null
      ) {

        try {
          localStorage.setItem(
            "goeikaapp:keyShift",
            storedValue
          );
        }

        catch (error) {
          console.warn(
            "キー設定を移行できませんでした。",
            error
          );
        }

      }

    }


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



keyShift =
  Math.max(
    -12,
    Math.min(
      12,
      keyShift
    )
  );



let keyMultiplier =
  Math.pow(
    2,
    keyShift / 12
  );



function updateKeyMultiplier() {

  keyMultiplier =
    Math.pow(
      2,
      keyShift / 12
    );

}



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



function saveKeyShift() {

  try {

    localStorage.setItem(
      "goeikaapp:keyShift",
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



keyDown.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    if (
      keyShift <= -12
    ) {

      return;

    }


    keyShift--;


    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



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


    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



keyDisplay.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    keyShift = 0;


    updateKeyMultiplier();


    updateKeyDisplay();

    saveKeyShift();

  }
);



updateKeyDisplay();



if (
  "audioSession" in navigator
) {

  // iOSのマナーモードでも再生音として扱われるよう明示する。
  navigator.audioSession.type =
    "playback";

}



// Safariの旧実装ではwebkitAudioContextを使用する。
const AudioContextClass =

  window.AudioContext ||
  window.webkitAudioContext;

// iOSでは先行作成が不安定なため、最初のユーザー操作まで生成を遅らせる。
let audioContext =
  null;


let audioContextNeedsReset =
  false;

// AudioContextを再利用可能な状態へ整える。

async function ensureAudioContext() {


  if (
    !audioContext
  ) {

    audioContext =
      new AudioContextClass();

  }



  if (
    audioContextNeedsReset
  ) {

    // iOSで復帰しない場合に備え、ユーザー操作中に新しいContextへ交換する。
    audioContextNeedsReset =
      false;



    const oldAudioContext =
      audioContext;



    audioContext =
      new AudioContextClass();



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



  if (
    audioContext.state ===
      "closed"
  ) {

    // closed状態はresumeできないため作り直す。
    audioContext =
      new AudioContextClass();

  }



  if (
    audioContext.state ===
      "suspended" ||
    audioContext.state ===
      "interrupted"
  ) {

    await audioContext.resume();

  }


  // resume成功後も状態を確認し、無音のまま表示だけ進むことを防ぐ。
  if (
    audioContext.state !==
      "running"
  ) {

    throw new Error(
      "AudioContextがrunningになっていません。state=" +
      audioContext.state
    );

  }

}



// バックグラウンド移行時に音声と演奏状態を破棄する。

document.addEventListener(
  "visibilitychange",

  function() {


    if (
      document.visibilityState ===
        "hidden"
    ) {


      stopSound();

      hideNotePress();


      const oldAudioContext =
        audioContext;



      // close完了前に参照を外し、復帰時の再利用を防ぐ。
      audioContext =
        null;



      audioContextNeedsReset =
        false;



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


  masterGain.gain.setValueAtTime(
    0.0001,
    now
  );


  // クリックノイズを避けるため、0.02秒かけて立ち上げる。
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


  clickOsc.type =
    "triangle";


  // 4倍音を加えて弦を弾いた瞬間の成分を作る。
  clickOsc.frequency.value =
    frequency * 4;


  clickGain.gain.setValueAtTime(
    0.18,
    now
  );


  // アタック音だけを0.08秒で減衰させる。
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


  flashMarker.style.left =
    x + "px";


  flashMarker.style.top =
    y + "px";



  const animations =
    flashMarker.getAnimations();

  for (
    const animation
    of animations
  ) {

    animation.cancel();

  }



  flashMarker.animate(

    [

      {

        opacity: 1,

        transform:
          "translate(-50%, -50%) scale(0.35)"

      },


      {

        opacity: 0.9,

        transform:
          "translate(-50%, -50%) scale(1)",

        offset: 0.4

      },


      {

        opacity: 0,

        transform:
          "translate(-50%, -50%) scale(1.5)"

      }

    ],


    {

      duration: 350,

      easing:
        "ease-out"

    }

  );

}



// =====================================
// 音符の押下表示
// =====================================

// notes.jsの中心座標に、区間ごとの長さと角度を組み合わせる。
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

// 中心線の両端を丸め、鍵盤の端の押しやすさと余白の誤反応を両立する。

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


// マルチタッチ時も最初のpointerだけを演奏用に追跡する。
let activePointerId =
  null;


// pointermoveによる同じ音符の連打を防ぐ。
let lastPlayedNote =
  null;

// =====================================
// 指定位置の音符を探して鳴らす
// =====================================

function playNoteAtPointer(
  event
) {


  const rect =
    image.getBoundingClientRect();



  // 横向き時の画面座標を、音符データと同じ縦画面基準へ戻す。
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



  let nearestNote =
    null;

  // 高頻度のpointermoveで平方根の計算を避ける。
  let nearestDistanceSquared =
    Infinity;



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



  if (
    !nearestNote ||
    nearestDistanceSquared >
    hitRadiusSquared
  ) {


    stopSound();

    hideNotePress();


    // 範囲外を挟んで同じ音符へ戻った場合は再発音できるようにする。
    lastPlayedNote =
      null;


    return;

  }



  if (
    nearestNote ===
    lastPlayedNote
  ) {


    return;

  }



  lastPlayedNote =
    nearestNote;



  const shiftedFrequency =

    nearestNote.frequency *
    keyMultiplier;



  playSound(
    shiftedFrequency
  );


  showNotePress(
    nearestNote
  );



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



    // 音声初期化中に終了した操作を演奏として開始しない。
    if (
      event.pointerId !==
      activePointerId
    ) {

      return;

    }

    isPointerPlaying =
      true;

    activePointerId =
      event.pointerId;

    lastPlayedNote =
      null;

    // 画像外へ移動してもスライド操作を追跡する。
    try {

      image.setPointerCapture(
        event.pointerId
      );

    }

    catch (error) {


      // Pointer Capture非対応でも通常のタップ演奏は継続する。
      console.warn(
        "Pointer Captureを開始できませんでした。",
        error
      );

    }



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


    if (
      !isPointerPlaying
    ) {

      return;

    }



    if (
      event.pointerId !==
      activePointerId
    ) {

      return;

    }



    playNoteAtPointer(
      event
    );

  }

);



// =====================================
// スライド演奏終了
// =====================================

function resetPointerPlaying() {

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


  if (
    event.pointerId !==
    activePointerId
  ) {

    return;

  }



  resetPointerPlaying();

}



image.addEventListener(
  "pointerup",

  finishPointerPlaying
);



image.addEventListener(
  "pointercancel",

  finishPointerPlaying
);



// Pointer Capture非対応時も画像外の終了操作を検出し、持続音を止める。
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



image.addEventListener(
  "lostpointercapture",

  function(event) {


    // 予期せぬCapture解除でも演奏状態を残さない。
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


const cacheNameValue =
  document.getElementById(
    "cacheNameValue"
  );


const viewportDebugValues =
  document.getElementById(
    "viewportDebugValues"
  );


// 画面外の要素でCSSのviewport単位の実寸を測る。
const viewportUnitProbes = {};

for (const unit of ["vh", "dvh", "svh", "lvh"]) {

  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    `position:fixed;left:-10000px;top:0;width:1px;height:100${unit};visibility:hidden;pointer-events:none;contain:strict;`;
  document.body.appendChild(probe);
  viewportUnitProbes[unit] = probe;

}


function updateViewportDebug() {

  if (!isInfoDialogOpen()) {
    return;
  }

  const vv = window.visualViewport;
  const css = getComputedStyle(document.documentElement);
  const number = value =>
    value == null ? "—" : String(value);

  const lines = [
    "Viewport Debug",
    "----------------",
    `window.innerWidth: ${window.innerWidth}`,
    `window.innerHeight: ${window.innerHeight}`,
    `window.outerWidth: ${window.outerWidth}`,
    `window.outerHeight: ${window.outerHeight}`,
    `window.scrollY: ${window.scrollY}`,
    `documentElement.clientWidth: ${document.documentElement.clientWidth}`,
    `documentElement.clientHeight: ${document.documentElement.clientHeight}`,
    `documentElement.scrollTop: ${document.documentElement.scrollTop}`,
    `documentElement.rect.top: ${document.documentElement.getBoundingClientRect().top}`,
    `body.rect.top: ${document.body.getBoundingClientRect().top}`,
    `visualViewport.width: ${number(vv?.width)}`,
    `visualViewport.height: ${number(vv?.height)}`,
    `visualViewport.offsetTop: ${number(vv?.offsetTop)}`,
    `visualViewport.pageTop: ${number(vv?.pageTop)}`,
    `visualViewport.offsetLeft: ${number(vv?.offsetLeft)}`,
    `visualViewport.scale: ${number(vv?.scale)}`,
    ...["vh", "dvh", "svh", "lvh"].map(unit =>
      `100${unit}: ${getComputedStyle(viewportUnitProbes[unit]).height}`
    ),
    `--app-height: ${css.getPropertyValue("--app-height").trim() || "(未設定)"}`,
    `display-mode standalone: ${window.matchMedia("(display-mode: standalone)").matches}`,
    `navigator.standalone: ${number(navigator.standalone)}`,
    `orientation: ${number(screen.orientation?.type)}`,
    `screen: ${screen.width} x ${screen.height}`,
    `devicePixelRatio: ${window.devicePixelRatio}`
  ];

  viewportDebugValues.textContent =
    lines.join("\n");

}


window.addEventListener("resize", updateViewportDebug);
window.addEventListener("orientationchange", updateViewportDebug);
window.addEventListener("scroll", updateViewportDebug);

if (window.visualViewport) {

  window.visualViewport.addEventListener(
    "resize",
    updateViewportDebug
  );

  window.visualViewport.addEventListener(
    "scroll",
    updateViewportDebug
  );

}


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


async function updateInfoCacheName() {

  cacheNameValue.textContent =
    "確認中…";

  if (
    !("serviceWorker" in navigator)
  ) {

    cacheNameValue.textContent =
      "利用できません";

    return;

  }

  try {

    const worker =
      navigator.serviceWorker.controller ||
      (await navigator.serviceWorker.getRegistration())?.active;

    if (!worker) {

      cacheNameValue.textContent =
        "利用できません";

      return;

    }

    const channel =
      new MessageChannel();

    const cacheName =
      await new Promise((resolve, reject) => {

        const timeout =
          setTimeout(() => {

            channel.port1.close();
            reject(new Error("キャッシュ名の取得がタイムアウトしました"));

          }, 3000);

        channel.port1.onmessage =
          event => {

            clearTimeout(timeout);
            channel.port1.close();
            resolve(event.data?.cacheName);

          };

        worker.postMessage(
          { type: "GET_CACHE_NAME" },
          [channel.port2]
        );

      });

    cacheNameValue.textContent =
      typeof cacheName === "string"
        ? cacheName
        : "取得できません";

  } catch (error) {

    cacheNameValue.textContent =
      "取得できません";

  }

}



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


  // キーボード操作の起点をダイアログ内へ移す。
  infoCloseButton.focus();

  updateViewportDebug();
  updateInfoCacheName();

}



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



infoButton.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    openInfoDialog();

  }
);



infoCloseButton.addEventListener(
  "click",

  function(event) {

    event.stopPropagation();


    closeInfoDialog();

  }
);



infoOverlay.addEventListener(
  "pointerdown",

  function(event) {

    if (
      event.target ===
      infoOverlay
    ) {

      closeInfoDialog();

    }

  }
);



infoDialog.addEventListener(
  "pointerdown",

  function(event) {

    event.stopPropagation();

  }
);



// キーボードフォーカスをモーダル内に閉じ込める。
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
