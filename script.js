// =====================================
// HTML要素
// =====================================

const image =
  document.getElementById(
    "onpuImage"
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



// =====================================
// キーコントローラー位置
//
// 画像左上 = 0, 0
// 画像右下 = 1, 1
//
// この座標が
// キーコントローラーの中心になる
// =====================================

const keyControlPosition = {

  x: 0.495,
  y: 0.91

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



// =====================================
// 画像読み込み時に位置設定
// =====================================

image.addEventListener(
  "load",
  updateKeyControlPosition
);



// =====================================
// 画面サイズ変更時にも再計算
// =====================================

window.addEventListener(
  "resize",
  updateKeyControlPosition
);



// =====================================
// 画像がキャッシュ済みの場合
// =====================================

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



// -12 ～ +12 に制限

keyShift =
  Math.max(
    -12,
    Math.min(
      12,
      keyShift
    )
  );



// =====================================
// キー表示
// =====================================

function updateKeyDisplay() {

  if (keyShift > 0) {

    keyDisplay.textContent =
      "+" + keyShift;

  }

  else if (keyShift < 0) {

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

    event.stopPropagation();


    if (
      keyShift <= -12
    ) {

      return;

    }


    keyShift--;


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


    updateKeyDisplay();

    saveKeyShift();

  }
);



updateKeyDisplay();



// =====================================
// AudioContext
// =====================================

const AudioContextClass =
  window.AudioContext ||
  window.webkitAudioContext;


const audioContext =
  new AudioContextClass();



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


  masterGain.gain.setValueAtTime(
    0.0001,
    now
  );


  masterGain.gain
    .exponentialRampToValueAtTime(
      0.6,
      now + 0.01
    );


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
  // 弦を弾いた瞬間
  // ---------------------------------

  const clickOsc =
    audioContext.createOscillator();


  const clickGain =
    audioContext.createGain();


  clickOsc.type =
    "triangle";


  clickOsc.frequency.value =
    frequency * 4;


  clickGain.gain.setValueAtTime(
    0.18,
    now
  );


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

  osc1.start(now);

  osc2.start(now);

  osc3.start(now);

  clickOsc.start(now);



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


  flashMarker.style.left =
    x + "px";


  flashMarker.style.top =
    y + "px";


  flashMarker.classList.remove(
    "flash"
  );


  /*
    ブラウザに一度反映させることで
    連続タップでも
    アニメーションを再生できる
  */

  void flashMarker.offsetWidth;


  flashMarker.classList.add(
    "flash"
  );

}



// =====================================
// 画像クリック
// =====================================

image.addEventListener(
  "pointerdown",

  async function(event) {


    // ---------------------------------
    // iPhone等のAudioContext対策
    // ---------------------------------

    if (
      audioContext.state ===
      "suspended"
    ) {

      await audioContext.resume();

    }



    // ---------------------------------
    // 現在表示中の画像位置
    // ---------------------------------

    const rect =
      image.getBoundingClientRect();



    // ---------------------------------
    // 表示画像上のクリック座標
    // ---------------------------------

    const displayX =
      event.clientX -
      rect.left;


    const displayY =
      event.clientY -
      rect.top;



    // ---------------------------------
    // 0～1の比率座標
    // ---------------------------------

    const clickX =
      displayX /
      rect.width;


    const clickY =
      displayY /
      rect.height;



    // ---------------------------------
    // 一番近い音符
    // ---------------------------------

    let nearestNote =
      null;


    let nearestDistance =
      Infinity;



    for (
      const note
      of notes
    ) {


      const dx =
        clickX -
        note.xRatio;


      const dy =
        clickY -
        note.yRatio;


      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );


      if (
        distance <
        nearestDistance
      ) {

        nearestDistance =
          distance;


        nearestNote =
          note;

      }

    }



    // ---------------------------------
    // 音符範囲内なら鳴らす
    // ---------------------------------

    if (
      nearestNote &&
      nearestDistance <=
      hitRadius
    ) {


      // キー変更を反映

      const shiftedFrequency =

        nearestNote.frequency *

        Math.pow(
          2,
          keyShift / 12
        );



      playSound(
        shiftedFrequency
      );



      flash(
        displayX,
        displayY
      );

    }


  }
);