import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundEffects } from "./sfx";

describe("SoundEffects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("synthesizes tones via AudioContext and respects mute toggle", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);

    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
      createOscillator() {
        return {
          type: "sine",
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start,
          stop,
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }

    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = new SoundEffects();

    expect(sfx.play("tick")).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);

    expect(sfx.play("start")).toBe(true);
    expect(start).toHaveBeenCalledTimes(4);

    expect(sfx.play("correct")).toBe(true);
    expect(start).toHaveBeenCalledTimes(7);

    expect(sfx.play("wrong")).toBe(true);
    expect(start).toHaveBeenCalledTimes(9);

    expect(sfx.toggleMute()).toBe(true);
    expect(sfx.play("tick")).toBe(false);
    expect(start).toHaveBeenCalledTimes(9);

    expect(sfx.toggleMute()).toBe(false);
    expect(sfx.play("tick")).toBe(true);
    expect(start).toHaveBeenCalledTimes(10);

    sfx.destroy();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("gracefully returns false when AudioContext is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    const sfx = new SoundEffects();
    expect(sfx.play("tick")).toBe(false);
  });
});
