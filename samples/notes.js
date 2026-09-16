/*
  keyboard-chart.png と鍵判定の対応情報。
  画像を差し替える場合は、基準寸法と各領域を一緒に更新する。
  自動テストでも画像の実寸とこの基準寸法が一致することを確認する。
*/
const keyboardLayout = {

  imageWidth: 1100,
  imageHeight: 442,

  keyboardTopRatio: 0.113,
  blackKeyBottomRatio: 0.570,
  keyboardBottomRatio: 0.885,

  blackKeyAreas: [
    { left: 0.066, right: 0.100 },
    { left: 0.195, right: 0.228 },
    { left: 0.259, right: 0.293 },
    { left: 0.387, right: 0.421 },
    { left: 0.451, right: 0.485 },
    { left: 0.515, right: 0.549 },
    { left: 0.644, right: 0.677 },
    { left: 0.708, right: 0.742 },
    { left: 0.837, right: 0.870 },
    { left: 0.900, right: 0.935 }
  ],

  /*
    左右端に描かれた演奏対象外の黒鍵。
    白鍵の押下表示を切り欠くためだけに使用する。
    実際の黒鍵より少し外側まで広げ、白鍵端との重なりを確実に検出する。
  */
  nonPlayableBlackKeyAreas: [
    { left: 0.013, right: 0.035 },
    { left: 0.965, right: 0.986 }
  ],

  whiteKeyAreas: [
    { left: 0.013, right: 0.082 },
    { left: 0.082, right: 0.146 },
    { left: 0.146, right: 0.211 },
    { left: 0.211, right: 0.275 },
    { left: 0.275, right: 0.339 },
    { left: 0.339, right: 0.403 },
    { left: 0.403, right: 0.467 },
    { left: 0.467, right: 0.531 },
    { left: 0.531, right: 0.595 },
    { left: 0.595, right: 0.660 },
    { left: 0.660, right: 0.724 },
    { left: 0.724, right: 0.788 },
    { left: 0.788, right: 0.852 },
    { left: 0.852, right: 0.916 },
    { left: 0.916, right: 0.986 }
  ]

};


const notes = [

  // keyboard-chart.png の左から右へ、表記のある25鍵を半音階で登録する。
  { keyType: "white", keyIndex: 0,  frequency: 220.000 },
  { keyType: "black", keyIndex: 0,  frequency: 233.082 },
  { keyType: "white", keyIndex: 1,  frequency: 246.942 },
  { keyType: "white", keyIndex: 2,  frequency: 261.626 },
  { keyType: "black", keyIndex: 1,  frequency: 277.183 },
  { keyType: "white", keyIndex: 3,  frequency: 293.665 },
  { keyType: "black", keyIndex: 2,  frequency: 311.127 },
  { keyType: "white", keyIndex: 4,  frequency: 329.628 },
  { keyType: "white", keyIndex: 5,  frequency: 349.228 },
  { keyType: "black", keyIndex: 3,  frequency: 369.994 },
  { keyType: "white", keyIndex: 6,  frequency: 391.995 },
  { keyType: "black", keyIndex: 4,  frequency: 415.305 },
  { keyType: "white", keyIndex: 7,  frequency: 440.000 },
  { keyType: "black", keyIndex: 5,  frequency: 466.164 },
  { keyType: "white", keyIndex: 8,  frequency: 493.883 },
  { keyType: "white", keyIndex: 9,  frequency: 523.251 },
  { keyType: "black", keyIndex: 6,  frequency: 554.365 },
  { keyType: "white", keyIndex: 10, frequency: 587.330 },
  { keyType: "black", keyIndex: 7,  frequency: 622.254 },
  { keyType: "white", keyIndex: 11, frequency: 659.255 },
  { keyType: "white", keyIndex: 12, frequency: 698.456 },
  { keyType: "black", keyIndex: 8,  frequency: 739.989 },
  { keyType: "white", keyIndex: 13, frequency: 783.991 },
  { keyType: "black", keyIndex: 9,  frequency: 830.609 },
  { keyType: "white", keyIndex: 14, frequency: 880.000 }

];
