export type SoundEffect = "tick" | "start" | "correct" | "wrong";

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
}

export class SoundEffects {
  private ctx: AudioContext | null = null;
  muted = false;

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = getAudioContextConstructor();
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    {
      freq,
      endFreq,
      type = "sine",
      startOffset = 0,
      duration = 0.1,
      gain = 0.12,
    }: {
      freq: number;
      endFreq?: number;
      type?: OscillatorType;
      startOffset?: number;
      duration?: number;
      gain?: number;
    },
  ): void {
    const startTime = ctx.currentTime + startOffset;
    const stopTime = startTime + duration;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        stopTime,
      );
    }

    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(
      gain,
      startTime + Math.min(0.015, duration * 0.25),
    );
    amp.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(stopTime);
  }

  play(effect: SoundEffect): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;

    try {
      if (effect === "tick") {
        this.tone(ctx, {
          freq: 660,
          endFreq: 880,
          type: "triangle",
          duration: 0.045,
          gain: 0.08,
        });
      } else if (effect === "start") {
        // Ascending festive triad (C5 - E5 - G5)
        this.tone(ctx, {
          freq: 523.25,
          type: "triangle",
          startOffset: 0,
          duration: 0.11,
          gain: 0.12,
        });
        this.tone(ctx, {
          freq: 659.25,
          type: "triangle",
          startOffset: 0.08,
          duration: 0.11,
          gain: 0.12,
        });
        this.tone(ctx, {
          freq: 783.99,
          type: "triangle",
          startOffset: 0.16,
          duration: 0.22,
          gain: 0.14,
        });
      } else if (effect === "correct") {
        // Bright major arpeggio chime (G5 - B5 - D6)
        this.tone(ctx, {
          freq: 783.99,
          type: "sine",
          startOffset: 0,
          duration: 0.12,
          gain: 0.14,
        });
        this.tone(ctx, {
          freq: 987.77,
          type: "sine",
          startOffset: 0.09,
          duration: 0.12,
          gain: 0.14,
        });
        this.tone(ctx, {
          freq: 1174.66,
          type: "triangle",
          startOffset: 0.18,
          duration: 0.28,
          gain: 0.16,
        });
      } else if (effect === "wrong") {
        // Gentle descending two-tone buzzer
        this.tone(ctx, {
          freq: 260,
          endFreq: 220,
          type: "sawtooth",
          startOffset: 0,
          duration: 0.14,
          gain: 0.08,
        });
        this.tone(ctx, {
          freq: 195,
          endFreq: 155,
          type: "sawtooth",
          startOffset: 0.13,
          duration: 0.24,
          gain: 0.09,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
