import gsap from "gsap";
import type { RajaBommaiHost } from "./raja-bommai";

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
}

export function computeRmsLevel(samples: Uint8Array<ArrayBuffer>): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const centered = (samples[i]! - 128) / 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  // Speech RMS typically sits in 0.02..0.28; boost into 0..1 for visible mouth motion.
  return Math.min(1, rms * 3.8);
}

export interface PlaySequenceOptions {
  fallbackDurationMs?: number;
  onComplete?: () => void;
}

export class HostVoicePlayer {
  private readonly host: RajaBommaiHost;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private sourceConnected = false;
  private smoothedLevel = 0;
  private sequenceToken = 0;
  private destroyed = false;
  private tickerActive = false;
  muted = false;

  private readonly onTick = (): void => {
    if (
      this.destroyed ||
      this.muted ||
      !this.analyser ||
      !this.timeData ||
      !this.audioEl ||
      this.audioEl.paused
    ) {
      return;
    }
    this.analyser.getByteTimeDomainData(this.timeData);
    const target = computeRmsLevel(this.timeData);
    // Fast attack, slightly gentler release so syllables read cleanly
    const alpha = target > this.smoothedLevel ? 0.55 : 0.28;
    this.smoothedLevel =
      this.smoothedLevel + (target - this.smoothedLevel) * alpha;
    this.host.setMouthLevel(this.smoothedLevel);
  };

  constructor(
    host: RajaBommaiHost,
    { muted = false }: { muted?: boolean } = {},
  ) {
    this.host = host;
    this.muted = muted;
  }

  setMuted(muted: boolean): boolean {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
    return this.muted;
  }

  toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  unlock(): void {
    if (this.destroyed || this.muted) return;
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
  }

  private ensureAudioGraph(): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;
    if (!this.audioEl) {
      try {
        this.audioEl = new Audio();
        this.audioEl.preload = "auto";
      } catch {
        return null;
      }
    }

    if (!this.ctx) {
      const Ctor = getAudioContextConstructor();
      if (Ctor) {
        try {
          this.ctx = new Ctor();
        } catch {
          this.ctx = null;
        }
      }
    }

    if (this.ctx && !this.sourceConnected) {
      try {
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        const source = this.ctx.createMediaElementSource(this.audioEl);
        source.connect(analyser);
        analyser.connect(this.ctx.destination);
        this.analyser = analyser;
        this.timeData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        this.sourceConnected = true;
      } catch {
        this.analyser = null;
        this.timeData = null;
        this.sourceConnected = true;
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    return this.audioEl;
  }

  private startTicker(): void {
    if (this.tickerActive) return;
    this.tickerActive = true;
    gsap.ticker.add(this.onTick);
  }

  private stopTicker(): void {
    if (!this.tickerActive) return;
    this.tickerActive = false;
    gsap.ticker.remove(this.onTick);
    this.smoothedLevel = 0;
  }

  stop(): void {
    this.sequenceToken += 1;
    this.stopTicker();
    if (this.audioEl) {
      try {
        this.audioEl.onended = null;
        this.audioEl.onerror = null;
        this.audioEl.pause();
      } catch {
        // Ignore media pause errors in non-browser test environments
      }
    }
    this.host.setTalking(false);
  }

  playSequence(urls: string[], options: PlaySequenceOptions = {}): void {
    const { fallbackDurationMs = 2400, onComplete } = options;
    this.stop();
    if (this.destroyed) return;

    const validUrls = urls.filter((u) => u.trim().length > 0);
    if (this.muted || validUrls.length === 0) {
      if (fallbackDurationMs > 0) {
        this.host.speakFor(fallbackDurationMs);
      }
      onComplete?.();
      return;
    }

    const audio = this.ensureAudioGraph();
    if (!audio) {
      if (fallbackDurationMs > 0) {
        this.host.speakFor(fallbackDurationMs);
      }
      onComplete?.();
      return;
    }

    const token = this.sequenceToken;
    let index = 0;

    const finishWithFallback = (): void => {
      if (token !== this.sequenceToken || this.destroyed) return;
      this.stopTicker();
      if (fallbackDurationMs > 0) {
        this.host.speakFor(fallbackDurationMs);
      } else {
        this.host.setTalking(false);
      }
      onComplete?.();
    };

    const playNext = (): void => {
      if (token !== this.sequenceToken || this.destroyed) return;
      const nextUrl = validUrls[index];
      index += 1;
      if (!nextUrl) {
        this.stopTicker();
        this.host.setTalking(false);
        onComplete?.();
        return;
      }

      audio.onended = () => {
        playNext();
      };
      audio.onerror = () => {
        finishWithFallback();
      };
      audio.src = nextUrl;

      let playPromise: Promise<void> | undefined;
      try {
        playPromise = audio.play();
      } catch {
        finishWithFallback();
        return;
      }

      if (!playPromise || typeof playPromise.then !== "function") {
        finishWithFallback();
        return;
      }

      this.host.setTalking(true);
      if (this.analyser && this.timeData) {
        this.startTicker();
      }

      playPromise.catch(() => {
        finishWithFallback();
      });
    };

    playNext();
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
