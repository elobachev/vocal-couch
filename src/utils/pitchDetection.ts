import { PitchDetectionResult } from '../types';
import { frequencyToMidi, getMidiNoteName, getMidiNoteNameOnly } from './musicUtils';

export class PitchDetector {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private microphone: MediaStream | null = null;

  // Time-domain buffers
  private timeData: Float32Array | null = null;
  private yinBuffer: Float32Array | null = null; // CMNDF values
  private timeBufferSize: number = 0;

  // Config
  private readonly minFreq = 80;    // Hz
  private readonly maxFreq = 2000;  // Hz
  private readonly yinThreshold = 0.15; // Typical 0.1–0.2
  private readonly vadRmsThreshold = 0.01; // Simple energy threshold for VAD

  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('PitchDetector already initialized');
      return;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          autoGainControl: false,
          noiseSuppression: true,
          ...(window.AudioContext && { sampleRate: 44100 }),
        },
      } as MediaStreamConstraints;

      this.microphone = await navigator.mediaDevices.getUserMedia(constraints);

      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      const options: AudioContextOptions = { latencyHint: 'interactive' };
      if (window.AudioContext) {
        options.sampleRate = 44100;
      }

      this.audioContext = new AudioContextClass(options);

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        if (this.audioContext.state === 'suspended') {
          throw new Error('AudioContext remains suspended - user interaction may be required');
        }
      }

      this.analyserNode = this.audioContext.createAnalyser();
      // For time-domain YIN we want enough window length for ~80Hz fundamental
      // 4096 at 44.1kHz ≈ 93 ms — достаточно, и остаётся интерактивным
      this.analyserNode.fftSize = 4096;
      this.analyserNode.smoothingTimeConstant = 0; // no smoothing in time-domain buffer

      this.timeBufferSize = this.analyserNode.fftSize; // full time-domain size
      this.timeData = new Float32Array(this.timeBufferSize);
      this.yinBuffer = new Float32Array(this.timeBufferSize);

      const source = this.audioContext.createMediaStreamSource(this.microphone);
      source.connect(this.analyserNode);

      this.isInitialized = true;
      console.log('PitchDetector initialized successfully (YIN)');
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to access microphone: ${error}`);
    }
  }

  detectPitch(): PitchDetectionResult | null {
    if (!this.isInitialized || !this.analyserNode || !this.timeData || !this.yinBuffer || !this.audioContext) {
      return null;
    }

    try {
      // Fill time-domain buffer (cross-browser: try float first, then byte fallback)
      try {
        (this.analyserNode as any).getFloatTimeDomainData(this.timeData);
      } catch {
        const byteArray = new Uint8Array(this.timeBufferSize);
        this.analyserNode.getByteTimeDomainData(byteArray);
        for (let i = 0; i < this.timeBufferSize; i++) {
          // Convert [0..255] to [-1..1]
          this.timeData[i] = (byteArray[i] - 128) / 128;
        }
      }

      // --- VAD: simple RMS energy gate ---
      const rms = this.computeRMS(this.timeData);
      if (!isFinite(rms) || rms < this.vadRmsThreshold) {
        return null;
      }

      const sampleRate = this.audioContext.sampleRate || 44100;
      const minTau = Math.max(2, Math.floor(sampleRate / this.maxFreq)); // high freq -> small lag
      const maxTau = Math.min(this.timeBufferSize - 1, Math.floor(sampleRate / this.minFreq));

      const freq = this.yinDetectFrequency(this.timeData, this.yinBuffer, minTau, maxTau, sampleRate);
      if (!isFinite(freq) || freq < this.minFreq || freq > this.maxFreq) {
        return null;
      }

      const pitch = frequencyToMidi(freq);
      const noteName = getMidiNoteName(pitch);
      const noteNameOnly = getMidiNoteNameOnly(pitch);

      // Confidence/clarity from YIN minimum (stored by yinDetectFrequency via lastYinMin)
      const yinMin = this._lastYinMin;
      const clarity = Math.max(0, Math.min(1, 1 - yinMin));
      // Blend with RMS for a more intuitive confidence
      const confidence = Math.max(0, Math.min(1, 0.5 * clarity + 0.5 * Math.min(1, rms / 0.1)));

      return {
        frequency: freq,
        pitch,
        noteName,
        noteNameOnly,
        confidence,
        clarity,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error during pitch detection (YIN):', error);
      return null;
    }
  }

  private _lastYinMin: number = 1;

  private computeRMS(buf: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  /**
   * YIN CMNDF implementation with parabolic interpolation and subharmonic (octave) check.
   * Returns detected frequency in Hz, or NaN if not found.
   */
  private yinDetectFrequency(
    x: Float32Array,
    yin: Float32Array,
    minTau: number,
    maxTau: number,
    sampleRate: number,
  ): number {
    const N = x.length;
    const maxTauClamped = Math.min(maxTau, N - 1);

    // 1) Difference function d(tau)
    // We reuse yin[] temporarily as the raw difference function to save allocations.
    // After computing CMND we overwrite yin[] with normalized values.
    for (let tau = 0; tau <= maxTauClamped; tau++) {
      yin[tau] = 0;
    }

    for (let tau = 1; tau <= maxTauClamped; tau++) {
      let sum = 0;
      for (let i = 0, lim = N - tau; i < lim; i++) {
        const diff = x[i] - x[i + tau];
        sum += diff * diff;
      }
      yin[tau] = sum;
    }

    // 2) Cumulative mean normalized difference function CMND
    let runningSum = 0;
    yin[0] = 1;
    for (let tau = 1; tau <= maxTauClamped; tau++) {
      runningSum += yin[tau];
      yin[tau] = (yin[tau] * tau) / (runningSum || 1e-12);
    }

    // 3) Absolute threshold search
    let tauEstimate = -1;
    let yinMin = 1;
    for (let tau = Math.max(2, minTau); tau <= maxTauClamped; tau++) {
      const val = yin[tau];
      if (val < this.yinThreshold && val <= yinMin) {
        // local minimum check
        if (tau + 1 <= maxTauClamped && val <= yin[tau + 1]) {
          tauEstimate = tau;
          yinMin = val;
          break;
        }
      }
      if (val < yinMin) yinMin = val;
    }

    // If no threshold crossing, fall back to global minimum in range
    if (tauEstimate === -1) {
      let minV = Infinity;
      let minI = -1;
      for (let tau = Math.max(2, minTau); tau <= maxTauClamped; tau++) {
        if (yin[tau] < minV) {
          minV = yin[tau];
          minI = tau;
        }
      }
      tauEstimate = minI;
      yinMin = minV === Infinity ? 1 : minV;
      if (tauEstimate <= 0) {
        this._lastYinMin = 1;
        return NaN;
      }
    }

    // 4) Parabolic interpolation around tauEstimate on CMND curve
    let betterTau = tauEstimate;
    if (tauEstimate > 1 && tauEstimate < maxTauClamped) {
      const x0 = yin[tauEstimate - 1];
      const x1 = yin[tauEstimate];
      const x2 = yin[tauEstimate + 1];
      const denom = 2 * (2 * x1 - x0 - x2);
      if (Math.abs(denom) > 1e-12) {
        const delta = (x2 - x0) / denom; // in [-0.5, 0.5] typically
        betterTau = tauEstimate + delta;
      }
    }

    // 5) Subharmonic check: prefer 1/2 or 1/3 frequency if CMND significantly better
    let finalTau = betterTau;
    const checkAndMaybeReplace = (mult: number, margin = 0.02) => {
      const tau2 = betterTau * mult;
      if (tau2 <= maxTauClamped) {
        // simple linear interp on CMND to estimate value at non-integer lag
        const i = Math.floor(tau2);
        const frac = tau2 - i;
        const yA = yin[i];
        const yB = i + 1 <= maxTauClamped ? yin[i + 1] : yA;
        const yTau2 = yA + (yB - yA) * frac;
        const i0 = Math.floor(betterTau);
        const frac0 = betterTau - i0;
        const yA0 = yin[i0];
        const yB0 = i0 + 1 <= maxTauClamped ? yin[i0 + 1] : yA0;
        const yTau = yA0 + (yB0 - yA0) * frac0;
        if (yTau2 + margin < yTau) {
          finalTau = tau2;
        }
      }
    };

    // Try 2x and 3x tau (i.e., f/2 and f/3)
    checkAndMaybeReplace(2, 0.015);
    checkAndMaybeReplace(3, 0.02);

    this._lastYinMin = yinMin;
    const freq = sampleRate / finalTau;
    return freq;
  }

  cleanup(): void {
    this.isInitialized = false;

    if (this.microphone) {
      this.microphone.getTracks().forEach((track) => {
        track.stop();
        console.log('Microphone track stopped:', track.label);
      });
      this.microphone = null;
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(console.error);
      }
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.timeData = null;
    this.yinBuffer = null;
    this.timeBufferSize = 0;

    console.log('PitchDetector cleaned up completely');
  }

  get isActive(): boolean {
    return (
      this.isInitialized &&
      this.microphone !== null &&
      this.microphone.getTracks().some((track) => track.readyState === 'live')
    );
  }
}
