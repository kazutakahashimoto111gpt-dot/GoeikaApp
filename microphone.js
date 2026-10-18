"use strict";

window.GoeikaMicrophone = (() => {
  const SENSITIVITY_KEY = "goeikaapp:micSensitivity";
  const DEFAULT_SENSITIVITY = 5;
  // 起動直後の入力の立ち上がりを除き、約1秒の周囲音から基準を決める。
  const CALIBRATION_MS = 1200;
  const ANALYSIS_INTERVAL_MS = 40;

  function loadSensitivity() {
    try {
      const stored = localStorage.getItem(SENSITIVITY_KEY);
      const value = stored === null || stored.trim() === "" ? NaN : Number(stored);
      return Number.isInteger(value) && value >= 1 && value <= 10
        ? value : DEFAULT_SENSITIVITY;
    } catch (error) {
      return DEFAULT_SENSITIVITY;
    }
  }

  function release(session) {
    if (!session) return;
    if (session.frame !== null) cancelAnimationFrame(session.frame);
    for (const track of session.stream?.getTracks() || []) track.stop();
    session.source?.disconnect();
    session.analyser?.disconnect();
    if (session.context && session.context.state !== "closed") {
      session.context.close().catch(error => {
        console.warn("マイクのAudioContextを終了できませんでした。", error);
      });
    }
  }

  function errorMessage(error) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "マイクを使用できません。ブラウザや端末のマイク許可設定を確認してください。";
      case "NotFoundError":
      case "OverconstrainedError":
        return "使用できるマイクが見つかりません。接続を確認してください。";
      case "NotReadableError":
      case "AbortError":
        return "マイクを開始できません。他のアプリで使用中でないか確認し、再度お試しください。";
      default:
        return "音声入力を開始できませんでした。マイク開始を押して、もう一度お試しください。";
    }
  }

  function interpolatedDip(difference, lag) {
    const left = difference[lag - 1];
    const center = difference[lag];
    const right = difference[lag + 1];
    const curvature = left - 2 * center + right;
    const correction = curvature <= 0 ? 0 : Math.max(-0.5, Math.min(0.5, (left - right) / (2 * curvature)));
    return { lag: lag + correction, depth: Math.max(0, center - (left - right) * correction / 4) };
  }

  function originalWaveDifference(samples, lag, mean) {
    const whole = Math.floor(lag);
    const fraction = lag - whole;
    const square = fraction * fraction;
    const cube = square * fraction;
    // 元の波形を3次補間して比較し、高音の離散的な谷の深さを補正する。
    const weights = [
      -0.5 * fraction + square - 0.5 * cube,
      1 - 2.5 * square + 1.5 * cube,
      0.5 * fraction + 2 * square - 1.5 * cube,
      -0.5 * square + 0.5 * cube
    ];
    let difference = 0;
    let energy = 0;
    for (let index = 1; index < samples.length - whole - 2; index++) {
      const shifted = samples[index + whole - 1] * weights[0]
        + samples[index + whole] * weights[1]
        + samples[index + whole + 1] * weights[2]
        + samples[index + whole + 2] * weights[3];
      difference += (samples[index] - shifted) ** 2;
      energy += (samples[index] - mean) ** 2 + (shifted - mean) ** 2;
    }
    return energy > 0 ? difference / energy : 1;
  }

  function tonePower(samples, sampleRate, frequency, mean, work) {
    if (!work.window) {
      work.window = Float32Array.from(samples, (_, index) =>
        0.5 - 0.5 * Math.cos(2 * Math.PI * index / (samples.length - 1)));
    }
    const step = 2 * Math.PI * frequency / sampleRate;
    const cosineStep = Math.cos(step);
    const sineStep = Math.sin(step);
    let cosine = 1;
    let sine = 0;
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < samples.length; index++) {
      // 窓の端の不連続による漏れを抑え、隣り合う倍音の強さを比較する。
      const value = (samples[index] - mean) * work.window[index];
      real += value * cosine;
      imaginary += value * sine;
      const nextCosine = cosine * cosineStep - sine * sineStep;
      sine = sine * cosineStep + cosine * sineStep;
      cosine = nextCosine;
    }
    return real * real + imaginary * imaginary;
  }

  function supportsLowerPitch(samples, sampleRate, frequency, multiple, mean, work) {
    const fundamental = tonePower(samples, sampleRate, frequency, mean, work);
    const overtone = tonePower(samples, sampleRate, frequency * multiple, mean, work);
    // 主倍音の0.5%未満の電力は漏れや雑音と区別しにくいため、補正の根拠にしない。
    if (fundamental < overtone * 0.005) return false;
    const upperSideband = tonePower(samples, sampleRate, frequency * (2 * multiple - 1), mean, work);
    // 元の音を挟む成分がほぼ対称なら、音量変動による側帯波として補正を避ける。
    return fundamental >= upperSideband * 2;
  }

  // YINの累積平均正規化差分で周期を探し、倍音や雑音による誤検出を抑える。
  function estimatePitch(samples, sampleRate, work) {
    // 高音の周期を粗くしすぎず、倍音と音域外の声を区別できる解析密度を保つ。
    const stride = Math.max(1, Math.floor(sampleRate / 22050));
    const size = Math.floor(samples.length / stride);
    const rate = sampleRate / stride;
    const signal = work.signal;
    let mean = 0;
    for (let index = 0; index < size; index++) {
      let sum = 0;
      for (let offset = 0; offset < stride; offset++) sum += samples[index * stride + offset];
      signal[index] = sum / stride;
      mean += signal[index];
    }
    mean /= size;
    for (let index = 0; index < size; index++) signal[index] -= mean;

    // キー±12と点灯補正±1オクターブで必要な55〜3520Hzと、その外側も解析する。
    const minLag = 2;
    const maxLag = Math.min(Math.floor(rate / 50), Math.floor(size / 2) - 1);
    const windowSize = size - maxLag;
    const difference = work.difference;
    let cumulative = 0;
    difference[0] = 1;
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let index = 0; index < windowSize; index++) {
        const delta = signal[index] - signal[index + lag];
        sum += delta * delta;
      }
      cumulative += sum;
      difference[lag] = cumulative > 0 ? sum * lag / cumulative : 1;
    }
    for (let lag = minLag; lag < maxLag; lag++) {
      if (difference[lag] > difference[lag - 1] || difference[lag] > difference[lag + 1]) continue;
      const initial = interpolatedDip(difference, lag);
      // 高音も最初の谷から調べ、音域外の基本音を低い倍周期へ誤認しない。
      if (initial.depth >= 0.25) continue;
      initial.depth = originalWaveDifference(samples, initial.lag * stride, mean);
      // 声の揺れを許容しつつ、周期性の弱い雑音を除くための初期値。
      if (initial.depth >= 0.12) continue;
      let best = initial;
      // 基本音が弱い声の補正は、周期と周波数成分の両方が裏付ける場合に限る。
      for (const multiple of [2, 3]) {
        if (best.depth <= 0.02) break;
        const expected = Math.round(initial.lag * multiple);
        let candidate = -1;
        for (let longer = expected - multiple; longer <= Math.min(expected + multiple, maxLag - 1); longer++) {
          if (longer <= lag || difference[longer] > difference[longer - 1] || difference[longer] > difference[longer + 1]) continue;
          if (candidate < 0 || difference[longer] < difference[candidate]) candidate = longer;
        }
        if (candidate >= 0) {
          const deeper = interpolatedDip(difference, candidate);
          deeper.depth = originalWaveDifference(samples, deeper.lag * stride, mean);
          if (
            deeper.depth < best.depth * 0.3 &&
            supportsLowerPitch(samples, sampleRate, rate / deeper.lag, multiple, mean, work)
          ) best = deeper;
        }
      }
      let period = best.lag * stride;
      // 周期が短い高音では補間誤差が音域判定に響くため、元の波形で周期を絞り込む。
      if (best.lag < 32) {
        for (const step of [stride / 2, stride / 4]) {
          const depths = [-1, 0, 1].map(offset =>
            originalWaveDifference(samples, period + offset * step, mean));
          period += (interpolatedDip(depths, 1).lag - 1) * step;
        }
      }
      const frequency = sampleRate / period;
      return frequency >= 50 && frequency <= 4000 ? frequency : null;
    }
    return null;
  }

  return class GoeikaMicrophone {
    constructor({ onState, onLevel, onPitch }) {
      this.onState = onState;
      this.onLevel = onLevel;
      this.onPitch = onPitch;
      this.sensitivity = loadSensitivity();
      this.state = "stopped";
      this.session = null;
    }

    setSensitivity(value) {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) return;
      this.sensitivity = parsed;
      try {
        localStorage.setItem(SENSITIVITY_KEY, String(parsed));
      } catch (error) {
        // 保存できない環境でも、今回の利用中は調整値を反映する。
      }
    }

    setState(state, message) {
      this.state = state;
      this.onState(state, message);
    }

    stop(message = "マイク停止中") {
      const session = this.session;
      // 許可待ちの古い要求は、新しいセッションの状態を変更させない。
      this.session = null;
      release(session);
      this.onLevel(0);
      this.onPitch(null, 0);
      this.setState("stopped", message);
    }

    async start() {
      if (this.state !== "stopped") return;
      if (!window.isSecureContext) {
        this.stop("マイクにはHTTPSでの接続が必要です。開発時はlocalhostも使用できます。");
        return;
      }
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!navigator.mediaDevices?.getUserMedia || !Context) {
        this.stop("このブラウザはマイク入力に対応していません。対応ブラウザで開いてください。");
        return;
      }
      if (document.hidden) return;

      const session = { frame: null, stream: null, context: null, source: null, analyser: null };
      this.session = session;
      this.setState("requesting", "マイクの使用許可を待っています。停止で取り消せます。");
      try {
        // Safariでユーザー操作との関連が失われないよう、許可を待つ前に再開する。
        session.context = new Context();
        const resumed = session.context.resume().then(() => null, error => error);
        const supported = navigator.mediaDevices.getSupportedConstraints?.() || {};
        const audio = {};
        // 音量の自動変化や音色の加工を避け、音量しきい値と基本周波数を安定させる。
        for (const name of ["autoGainControl", "noiseSuppression", "echoCancellation"]) {
          if (supported[name]) audio[name] = { ideal: false };
        }
        if (supported.channelCount) audio.channelCount = { ideal: 1 };
        session.stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
        if (this.session !== session) {
          release(session);
          return;
        }
        const resumeError = await resumed;
        if (this.session !== session) {
          release(session);
          return;
        }
        if (resumeError) throw resumeError;
        if (session.context.state !== "running") throw new Error("音声入力を再開できません。");
        session.source = session.context.createMediaStreamSource(session.stream);
        session.analyser = session.context.createAnalyser();
        session.analyser.fftSize = 4096;
        session.source.connect(session.analyser);
        // 出力先へ接続せず、マイクの音をスピーカーへ流さない。
        session.samples = new Float32Array(session.analyser.fftSize);
        session.work = {
          signal: new Float32Array(session.samples.length),
          difference: new Float32Array(session.samples.length)
        };
        session.startedAt = null;
        session.lastAnalysis = -Infinity;
        session.noiseSamples = [];
        session.noiseFloor = 0;
        for (const track of session.stream.getAudioTracks()) {
          if (track.readyState === "ended") throw new Error("マイク入力が終了しています。");
          track.addEventListener("ended", () => {
            if (this.session === session) this.stop("マイクの接続が切れました。接続を確認して再度開始してください。");
          });
        }
        session.context.onstatechange = () => {
          if (this.session === session && session.context.state !== "running") {
            this.stop("音声入力が中断されました。マイク開始を押すと再開できます。");
          }
        };
        this.setState("calibrating", "周囲の音量を測定中です。約1秒間、歌わずにお待ちください。");
        session.frame = requestAnimationFrame(time => this.analyse(session, time));
      } catch (error) {
        if (this.session === session) this.stop(errorMessage(error));
        else release(session);
      }
    }

    analyse(session, time) {
      if (this.session !== session) return;
      session.frame = requestAnimationFrame(nextTime => this.analyse(session, nextTime));
      if (time - session.lastAnalysis < ANALYSIS_INTERVAL_MS) return;
      session.lastAnalysis = time;
      try {
        session.analyser.getFloatTimeDomainData(session.samples);
        let mean = 0;
        for (const value of session.samples) mean += value;
        mean /= session.samples.length;
        let energy = 0;
        for (const value of session.samples) energy += (value - mean) ** 2;
        const rms = Math.sqrt(energy / session.samples.length);
        // メーターは音程や感度と独立した、対数目盛りの入力音量を示す。
        this.onLevel(Math.max(0, Math.min(100, (20 * Math.log10(Math.max(rms, 0.000001)) + 60) / 60 * 100)));

        if (session.startedAt === null) session.startedAt = time;
        if (this.state === "calibrating") {
          if (time - session.startedAt >= 200) session.noiseSamples.push(rms);
          if (time - session.startedAt < CALIBRATION_MS) return;
          session.noiseSamples.sort((a, b) => a - b);
          // 一瞬の物音に引きずられないよう、周囲音の中央値を使う。
          session.noiseFloor = session.noiseSamples[Math.floor(session.noiseSamples.length / 2)] || 0;
          this.setState("listening", "声を伸ばすと、最も近い音符が点灯します。");
        }

        const proportion = (this.sensitivity - 1) / 9;
        // 小声でも差が出るよう、感度1の最低基準をメーター約65%にする。
        const minimumRms = 0.09 * Math.pow(0.002 / 0.09, proportion);
        const threshold = Math.max(minimumRms, session.noiseFloor * (3 - 1.5 * proportion));
        const muted = session.stream.getAudioTracks().some(track => track.muted);
        const pitch = !muted && rms >= threshold
          ? estimatePitch(session.samples, session.context.sampleRate, session.work) : null;
        this.onPitch(pitch, time);
      } catch (error) {
        this.stop("マイクの解析が中断されました。マイク開始を押して再度お試しください。");
      }
    }
  };
})();
