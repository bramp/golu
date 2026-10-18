import { afterEach, describe, expect, it, vi } from "vitest";
import { RajaBommaiHost, type HostState } from "./raja-bommai";

describe("RajaBommaiHost", () => {
  let host: RajaBommaiHost | undefined;

  afterEach(() => {
    host?.destroy();
    host = undefined;
    vi.useRealTimers();
  });

  it("mounts the SVG into a container and initializes to idle", () => {
    const container = document.createElement("div");
    const states: HostState[] = [];

    host = new RajaBommaiHost(container, {
      initialState: "idle",
      autoBlink: false,
      onStateChange: (s) => states.push(s),
    });

    expect(container.querySelector("svg.raja-svg")).toBe(host.svg);
    expect(host.state).toBe("idle");
    expect(host.isTalking).toBe(false);
    expect(states).toEqual(["idle"]);
  });

  it("transitions across all host states and auto-toggles talking appropriately", () => {
    const talkEvents: boolean[] = [];
    host = new RajaBommaiHost(undefined, {
      autoBlink: false,
      onTalkChange: (talking) => talkEvents.push(talking),
    });

    host.setState("wave");
    expect(host.state).toBe("wave");
    expect(host.isTalking).toBe(false);

    // Entering "asking" automatically starts lip-sync talking
    host.setState("asking");
    expect(host.state).toBe("asking");
    expect(host.isTalking).toBe(true);

    // Entering "thinking" or "sad" automatically stops lip-sync talking
    host.setState("thinking");
    expect(host.state).toBe("thinking");
    expect(host.isTalking).toBe(false);

    host.setTalking(true);
    expect(host.isTalking).toBe(true);

    host.setState("sad");
    expect(host.state).toBe("sad");
    expect(host.isTalking).toBe(false);

    host.setState("excited");
    expect(host.state).toBe("excited");
    expect(talkEvents).toEqual([true, false, true, false]);
  });

  it("supports timed speech with speakFor()", () => {
    vi.useFakeTimers();
    host = new RajaBommaiHost(undefined, { autoBlink: false });

    host.speakFor(1000);
    expect(host.isTalking).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(host.isTalking).toBe(false);
  });

  it("toggles pivot markers visibility and cleans up on destroy()", () => {
    host = new RajaBommaiHost(undefined, { autoBlink: false });
    host.setPivotsVisible(true);
    host.triggerBlink();
    host.destroy();

    // Subsequent calls after destroy should be no-ops
    host.setState("excited");
    expect(host.state).toBe("idle");
    expect(host.setTalking(true)).toBe(false);
  });
});
