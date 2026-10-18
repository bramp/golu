import { afterEach, describe, expect, it, vi } from "vitest";
import { RajaBommaiHost } from "./raja-bommai";
import { computeRmsLevel, HostVoicePlayer } from "./voice";

describe("computeRmsLevel", () => {
  it("returns 0 for silence (128 center) and scales loud waveforms up to 1", () => {
    const silence = new Uint8Array(new ArrayBuffer(64));
    silence.fill(128);
    expect(computeRmsLevel(silence)).toBe(0);

    const loud = new Uint8Array(new ArrayBuffer(64));
    loud.fill(255);
    expect(computeRmsLevel(loud)).toBe(1);
  });
});

describe("HostVoicePlayer", () => {
  let host: RajaBommaiHost | undefined;
  let player: HostVoicePlayer | undefined;

  afterEach(() => {
    player?.destroy();
    host?.destroy();
    player = undefined;
    host = undefined;
    vi.unstubAllGlobals();
  });

  it("plays a sequence of audio clips, drives analyser lip-sync, and calls onComplete", () => {
    const playedSrcs: string[] = [];
    let currentEnded: (() => void) | undefined;

    class FakeAudio {
      preload = "auto";
      paused = false;
      src = "";
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => {
        this.paused = false;
        playedSrcs.push(this.src);
        currentEnded = () => {
          this.paused = true;
          this.onended?.();
        };
        return Promise.resolve();
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
    }

    class FakeAudioContext {
      state = "running";
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createAnalyser() {
        return {
          fftSize: 256,
          smoothingTimeConstant: 0.5,
          connect: vi.fn(),
          getByteTimeDomainData(buf: Uint8Array) {
            buf.fill(200);
          },
        };
      }
      createMediaElementSource() {
        return { connect: vi.fn() };
      }
    }

    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("AudioContext", FakeAudioContext);

    host = new RajaBommaiHost(undefined, { autoBlink: false });
    player = new HostVoicePlayer(host);

    const onComplete = vi.fn();
    player.playSequence(["/a.mp3", "/b.mp3"], { onComplete });

    expect(playedSrcs).toEqual(["/a.mp3"]);
    expect(host.isTalking).toBe(true);

    // Finish first clip -> starts second clip
    currentEnded?.();
    expect(playedSrcs).toEqual(["/a.mp3", "/b.mp3"]);
    expect(onComplete).not.toHaveBeenCalled();

    // Finish second clip -> completes sequence and stops talking
    currentEnded?.();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(host.isTalking).toBe(false);
  });

  it("falls back to timed speakFor when muted or when play() rejects", async () => {
    class RejectingAudio {
      preload = "auto";
      paused = true;
      src = "";
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
      pause = vi.fn();
    }

    vi.stubGlobal("Audio", RejectingAudio);
    host = new RajaBommaiHost(undefined, { autoBlink: false });
    const speakSpy = vi.spyOn(host, "speakFor");
    player = new HostVoicePlayer(host);

    const onComplete = vi.fn();
    player.playSequence(["/blocked.mp3"], {
      fallbackDurationMs: 1800,
      onComplete,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(speakSpy).toHaveBeenCalledWith(1800);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Muted mode skips Audio.play() and immediately uses fallback
    player.toggleMute();
    expect(player.muted).toBe(true);
    const mutedComplete = vi.fn();
    player.playSequence(["/muted.mp3"], {
      fallbackDurationMs: 1200,
      onComplete: mutedComplete,
    });
    expect(mutedComplete).toHaveBeenCalledTimes(1);
  });
});
