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
    ? 1.10   // スマホ　最適な値は 1.10
    : 0.927   // PC・タブレット

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
// 画像読み込み時にキーコントローラーの位置設定
// =========================================

image.addEventListener(
  "load",
  updateKeyControlPosition
);



// ====================================================
// 画面サイズ変更時にもキーコントローラーの位置設定を再計算
// ====================================================

window.addEventListener(
  "resize",
  updateKeyControlPosition
);



// =============================================================
// 画像がキャッシュ済みの場合にもキーコントローラーの位置設定を再計算
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
    localStorage.getItem( /*"kongoKeyShift"というキー名で保存された文字列を数値に変換して取得*/
      "kongoKeyShift"
    )
  );


if (
  Number.isNaN(keyShift) /* NaNの場合は0にする */
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

    event.stopPropagation(); /*このキー操作はここだけのイベントとして扱い、親要素には処理させない*/


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

    event.stopPropagation(); /*このキー操作はここだけのイベントとして扱い、親要素には処理させない*/


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

    event.stopPropagation(); /*このキー操作はここだけのイベントとして扱い、親要素には処理させない*/


    keyShift = 0;


    updateKeyDisplay();

    saveKeyShift();

  }
);



updateKeyDisplay();



// ============================================
// AudioContext(実際に音を扱うオブジェクト)を作成
// ============================================

const AudioContextClass =
  window.AudioContext ||
  window.webkitAudioContext;
  /*AudioContext が使えるならそれを使う。なければ webkitAudioContext を使う。
  SafariはwebkitAudioContextしか使えないので、両方を定義しておく必要がある。*/  


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

  // 音量を調整するためのオブジェクトを作成
  const masterGain =
    audioContext.createGain();

  // 音量調整した音を
  // 最終的な出力先（スピーカー）につなぐ
  masterGain.connect(
    audioContext.destination
  );

  // 音が鳴り始める瞬間の音量を
  // ほぼ0に設定
  masterGain.gain.setValueAtTime(
    0.0001,
    now
  );

  // 0.01秒かけて
  // 音量を0.6まで一気に上げる
  masterGain.gain
    .exponentialRampToValueAtTime(
      0.6,
      now + 0.01
    );

  // その後、1.8秒後までに
  // 音量をほぼ0まで徐々に下げる
  masterGain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      now + 1.8
    );



// ---------------------------------
// 基音
// ---------------------------------


// 基本となる音を作る
// オシレーター（音の発生器）を作成
const osc1 =
  audioContext.createOscillator();


// 基音専用の
// 音量調整器を作成
const gain1 =
  audioContext.createGain();


// 音の波形を
// サイン波に設定
osc1.type =
  "sine";


// 基音の周波数を設定
osc1.frequency.value =
  frequency;


// 基音の音量を1.0に設定
gain1.gain.value =
  1.0;


// 基音
// ↓
// 基音専用の音量調整器
// の順につなぐ
osc1.connect(
  gain1
);


// 基音専用の音量調整器を
// 全体音量（masterGain）につなぐ
gain1.connect(
  masterGain
);




// ---------------------------------
// 2倍音
// ---------------------------------


// 2倍音を作る
// オシレーターを作成
const osc2 =
  audioContext.createOscillator();


// 2倍音専用の
// 音量調整器を作成
const gain2 =
  audioContext.createGain();


// 音の波形を
// サイン波に設定
osc2.type =
  "sine";


// 基音の2倍の周波数に設定
osc2.frequency.value =
  frequency * 2;


// 2倍音の音量を
// 基音より小さい0.35に設定
gain2.gain.value =
  0.35;


// 2倍音
// ↓
// 2倍音専用の音量調整器
// の順につなぐ
osc2.connect(
  gain2
);


// 2倍音専用の音量調整器を
// 全体音量（masterGain）につなぐ
gain2.connect(
  masterGain
);




// ---------------------------------
// 3倍音
// ---------------------------------


// 3倍音を作る
// オシレーターを作成
const osc3 =
  audioContext.createOscillator();


// 3倍音専用の
// 音量調整器を作成
const gain3 =
  audioContext.createGain();


// 音の波形を
// サイン波に設定
osc3.type =
  "sine";


// 基音の3倍の周波数に設定
osc3.frequency.value =
  frequency * 3;


// 3倍音の音量を
// さらに小さい0.15に設定
gain3.gain.value =
  0.15;


// 3倍音
// ↓
// 3倍音専用の音量調整器
// の順につなぐ
osc3.connect(
  gain3
);


// 3倍音専用の音量調整器を
// 全体音量（masterGain）につなぐ
gain3.connect(
  masterGain
);




// ---------------------------------
// 弦を弾いた瞬間の音
// ---------------------------------


// 弦を弾いた瞬間の
// 短い音を作るオシレーターを作成
const clickOsc =
  audioContext.createOscillator();


// 弦を弾いた瞬間の音専用の
// 音量調整器を作成
const clickGain =
  audioContext.createGain();


// 波形を三角波に設定
// 基音とは少し違う音質を作る
clickOsc.type =
  "triangle";


// 基音の4倍の周波数に設定
// 高い成分を加えて
// 弦を弾いた瞬間らしさを出す
clickOsc.frequency.value =
  frequency * 4;


// 鳴り始めの音量を
// 0.18に設定
clickGain.gain.setValueAtTime(
  0.18,
  now
);


// 0.08秒で音量をほぼ0まで下げる
// 一瞬だけ鳴る「弾いた音」を作る
clickGain.gain
  .exponentialRampToValueAtTime(
    0.0001,
    now + 0.08
  );


// 弦を弾いた瞬間の音
// ↓
// 専用の音量調整器
// の順につなぐ
clickOsc.connect(
  clickGain
);


// 専用の音量調整器を
// 全体音量（masterGain）につなぐ
clickGain.connect(
  masterGain
);



// ---------------------------------
// 再生開始
// ---------------------------------


// 基音の再生を
// 現在時刻（now）から開始
osc1.start(now);


// 2倍音の再生を
// 現在時刻（now）から開始
osc2.start(now);


// 3倍音の再生を
// 現在時刻（now）から開始
osc3.start(now);


// 弦を弾いた瞬間の音を
// 現在時刻（now）から開始
clickOsc.start(now);




// ---------------------------------
// 再生終了
// ---------------------------------


// 基音を
// 1.8秒後に停止
osc1.stop(
  now + 1.8
);


// 2倍音を
// 1.8秒後に停止
osc2.stop(
  now + 1.8
);


// 3倍音を
// 1.8秒後に停止
osc3.stop(
  now + 1.8
);


// 弦を弾いた瞬間の音は
// 短い音なので0.1秒後に停止
clickOsc.stop(
  now + 0.1
);


}


// =====================================
// タップ位置を光らせる
// =====================================

// タップした位置に
// flashMarkerを移動させて
// 点滅アニメーションを実行する
function flash(
  x,
  y
) {


  // flashMarkerの横位置を
  // タップしたX座標に設定
  flashMarker.style.left =
    x + "px";


  // flashMarkerの縦位置を
  // タップしたY座標に設定
  flashMarker.style.top =
    y + "px";


  // いったんflashクラスを削除する
  //
  // 前回のアニメーション状態を解除して
  // 再びアニメーションできるようにする
  flashMarker.classList.remove(
    "flash"
  );


  /*
    offsetWidthを読み取ることで
    ブラウザに現在の状態を一度反映させる

    これにより

    flashクラスを削除
        ↓
    ブラウザに反映
        ↓
    flashクラスを再追加

    という流れになり、
    連続タップでもアニメーションを
    最初から再生できる
  */

  void flashMarker.offsetWidth;


  // flashクラスを再び追加して
  // 点滅アニメーションを開始する
  flashMarker.classList.add(
    "flash"
  );

}



// =====================================
// 画像タップ時の処理
// =====================================

/*【処理の流れ】
タップ → 画像上の座標を求める → 比率座標に変換 → 全音符との距離を比較 → 最も近い音符を特定 → 
判定半径内ならキー変更を加えて鳴らす → タップ位置を光らせる */


image.addEventListener(
  "pointerdown", // pointerdownはマウス・タッチ・ペンなどを共通して扱えるイベント

  async function(event) {


    // ---------------------------------
    // iPhone等のAudioContext対策
    // ---------------------------------

    // iPhoneなどでは
    // AudioContextが停止状態になっていることがある
    //
    // suspendedなら
    // ユーザーのタップをきっかけに再開する
    
    if (
      audioContext.state ===
      "suspended"
    ) {

      await audioContext.resume();

    }



    // ---------------------------------
    // 現在表示中の画像位置・サイズ
    // ---------------------------------

    // 画像が現在画面上の
    // どこに、どの大きさで表示されているかを取得する
    //
    // rect.left   → 画像左端の位置
    // rect.top    → 画像上端の位置
    // rect.width  → 画像の表示幅
    // rect.height → 画像の表示高さ
    const rect =
      image.getBoundingClientRect();



    // ---------------------------------
    // 表示画像上のタップ座標
    // ---------------------------------

    // event.clientXは
    // 画面左端を基準としたタップ位置
    //
    // そこから画像左端の位置を引くことで
    // 「画像左端から何pxの場所をタップしたか」
    // を求める
    const displayX =
      event.clientX -
      rect.left;


    // Y座標も同様に
    // 画像上端から何pxの場所をタップしたかを求める
    const displayY =
      event.clientY -
      rect.top;



    // ---------------------------------
    // 0～1の比率座標に変換
    // ---------------------------------

    // X座標を画像の幅で割り
    // 0～1の比率に変換する
    //
    // 0   → 画像の左端
    // 0.5 → 画像の中央
    // 1   → 画像の右端
    const clickX =
      displayX /
      rect.width;


    // Y座標も同様に比率へ変換する
    //
    // 0   → 画像の上端
    // 0.5 → 画像の中央
    // 1   → 画像の下端
    const clickY =
      displayY /
      rect.height;



    // ---------------------------------
    // 一番近い音符を探す準備
    // ---------------------------------

    // 現時点では
    // 一番近い音符はまだ見つかっていないのでnull
    let nearestNote =
      null;


    // 一番近い音符までの距離
    //
    // 最初は比較対象がないので
    // Infinity（無限大）にしておく
    let nearestDistance =
      Infinity;



    // ---------------------------------
    // すべての音符との距離を調べる
    // ---------------------------------

    // notesに登録されている音符を
    // ひとつずつ取り出して調べる
    for (
      const note
      of notes
    ) {


      // タップ位置と音符位置の
      // X方向の差を求める
      const dx =
        clickX -
        note.xRatio;


      // タップ位置と音符位置の
      // Y方向の差を求める
      const dy =
        clickY -
        note.yRatio;


      // 三平方の定理を使って
      // タップ位置から音符までの
      // 直線距離を求める
      //
      // 距離 = √(横の差² + 縦の差²)
      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );


      // 今まで見つけた音符より
      // 今回の音符のほうが近ければ更新する
      if (
        distance <
        nearestDistance
      ) {

        // 最短距離を更新
        nearestDistance =
          distance;


        // 一番近い音符を
        // 今回の音符に更新
        nearestNote =
          note;

      }

    }



    // ---------------------------------
    // 音符の範囲内なら音を鳴らす
    // ---------------------------------

    // 一番近い音符が存在し、
    // さらにその距離が
    // hitRadius（タップ判定半径）以内なら
    // その音符がタップされたと判断する
    if (
      nearestNote &&
      nearestDistance <=
      hitRadius
    ) {


      // ---------------------------------
      // キー変更を音程に反映
      // ---------------------------------

      // 元の音符の周波数に
      // keyShiftによる半音単位の変化を加える
      //
      // 12半音上 → 周波数2倍
      // 12半音下 → 周波数1/2
      // 1半音上  → 2^(1/12)倍
      const shiftedFrequency =

        nearestNote.frequency *

        Math.pow(
          2,
          keyShift / 12
        );



      // ---------------------------------
      // 音を再生
      // ---------------------------------

      // キー変更後の周波数を
      // playSoundへ渡して音を鳴らす
      playSound(
        shiftedFrequency
      );



      // ---------------------------------
      // タップ位置を光らせる
      // ---------------------------------

      // 実際にタップした画像上の座標を渡して
      // flashMarkerを表示する
      flash(
        displayX,
        displayY
      );

    }


  }
);