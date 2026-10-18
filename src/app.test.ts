import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import demo from "../public/demo/questions.json";
import { kioskSpotlightDurationMs, mountApp } from "./app";
import { parseManifest } from "./manifest";

const manifest = parseManifest(demo);
let root: HTMLElement;
let cleanup: () => void;

function click(text: string): void {
  const button = Array.from(root.querySelectorAll("button")).find((node) =>
    node.textContent?.startsWith(text),
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  button.click();
}

function key(value: string): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: value, cancelable: true }),
  );
}

beforeEach(() => {
  root = document.createElement("main");
  document.body.append(root);
  cleanup = mountApp(root, manifest, { demo: true, base: "/golu/" });
});

afterEach(() => {
  cleanup();
  root.remove();
});

describe("playable app", () => {
  it("starts in kiosk explainer mode, zooms into dolls, and plays a full round", () => {
    expect(root.textContent).toContain("Demo pack");
    expect(root.textContent).toContain("Doll Spotlight (1 / 3)");
    expect(root.textContent).toContain("Orange Tent");
    expect(root.textContent).not.toContain("Quit to Kodi");
    expect(document.activeElement?.textContent).toBe("Start game");
    const kioskImg = root.querySelector<HTMLImageElement>("img");
    const kioskCanvas = root.querySelector<HTMLElement>(".golu-canvas");
    const spotlight = root.querySelector<HTMLElement>(".golu-spotlight");
    const rotateOverlay = root.querySelector<HTMLElement>(".rotate-overlay");
    const hostStage = root.querySelector<HTMLElement>(".raja-host-stage");
    expect(kioskImg?.src).toContain("/golu/demo/camping.svg");
    expect(kioskImg?.dataset.zoomed).toBe("true");
    expect(kioskCanvas?.style.transform).not.toBe("translate(0%, 0%) scale(1)");
    expect(spotlight?.style.left).toBe("10%");
    expect(spotlight?.style.top).toBe("52%");
    expect(rotateOverlay?.textContent).toContain(
      "Rotate your phone to landscape",
    );
    expect(hostStage?.querySelector("svg.raja-svg")).not.toBeNull();
    expect(hostStage?.dataset.hostState).toBe("wave");

    click("Show full Golu");
    expect(root.querySelector<HTMLImageElement>("img")?.dataset.zoomed).toBe(
      "false",
    );
    expect(
      root.querySelector<HTMLElement>(".golu-canvas")?.style.transform,
    ).toBe("translate(0%, 0%) scale(1)");
    click("Zoom to doll");
    expect(root.querySelector<HTMLImageElement>("img")?.dataset.zoomed).toBe(
      "true",
    );

    click("Next doll");
    expect(root.textContent).toContain("Doll Spotlight (2 / 3)");
    expect(root.textContent).toContain("Golden Sun");
    expect(hostStage?.dataset.hostState).toBe("asking");

    hostStage?.click();
    expect(hostStage?.dataset.hostState).toBe("asking");
    expect(root.querySelector("img")?.src).toContain("/golu/demo/camping.svg");
    for (const question of manifest.packs[0]!.questions) {
      click(question.options[question.correctIndex]!);
      expect(root.textContent).toContain("Correct!");
      expect(hostStage?.dataset.hostState).toBe("excited");
      expect(root.querySelectorAll(".answers button:disabled")).toHaveLength(4);
      expect(document.activeElement?.textContent).toMatch(
        /Next question|See results/,
      );
      click(question.id === "demo-water" ? "See results" : "Next question");
    }
    expect(root.textContent).toContain("3 / 3 correct");
    expect(root.querySelector<HTMLImageElement>("img")?.dataset.zoomed).toBe(
      "false",
    );
    click("Play again");
    expect(root.textContent).toContain("Score 0");
    key("Escape");
    expect(root.textContent).toContain("Doll Spotlight");
    expect(root.textContent).not.toContain("Score 0");
  });

  it("auto-advances the kiosk explainer on a timer", () => {
    vi.useFakeTimers();
    try {
      cleanup();
      cleanup = mountApp(root, manifest, {
        demo: true,
        base: "/golu/",
        kioskIntervalMs: 3000,
      });
      expect(root.textContent).toContain("Orange Tent");
      vi.advanceTimersByTime(3000);
      expect(root.textContent).toContain("Golden Sun");
      vi.advanceTimersByTime(3000);
      expect(root.textContent).toContain("Mountain Lake");
    } finally {
      vi.useRealTimers();
    }
  });

  it("scales default kiosk spotlight duration with explanation word count", () => {
    const shortQuestion = manifest.packs[0]!.questions[1]!;
    const longQuestion = {
      ...shortQuestion,
      explanation: Array(50).fill("tradition").join(" "),
    };
    expect(kioskSpotlightDurationMs(shortQuestion)).toBeGreaterThanOrEqual(
      10000,
    );
    expect(kioskSpotlightDurationMs(longQuestion)).toBeGreaterThan(
      kioskSpotlightDurationMs(shortQuestion),
    );
  });

  it("returns to kiosk mode after inactivity during a round", () => {
    vi.useFakeTimers();
    try {
      cleanup();
      cleanup = mountApp(root, manifest, {
        demo: true,
        base: "/golu/",
        inactivityTimeoutMs: 5000,
      });
      click("Start game");
      expect(root.textContent).toContain("Question 1 / 3");

      vi.advanceTimersByTime(3000);
      key("ArrowRight");
      vi.advanceTimersByTime(3000);
      expect(root.textContent).toContain("Question 1 / 3");

      vi.advanceTimersByTime(2500);
      expect(root.textContent).toContain("Doll Spotlight");
      expect(root.textContent).not.toContain("Question 1 / 3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves focus in a 2x2 grid and keeps a single tab stop", () => {
    click("Start game");
    expect(document.activeElement?.textContent).toBe("Orange");
    key("ArrowRight");
    expect(document.activeElement?.textContent).toBe("Blue");
    key("ArrowDown");
    expect(document.activeElement?.textContent).toBe("Green");
    key("ArrowLeft");
    expect(document.activeElement?.textContent).toBe("Purple");
    key("ArrowUp");
    expect(document.activeElement?.textContent).toBe("Orange");
    expect(root.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    const pointerTarget = root.querySelectorAll("button")[2]!;
    pointerTarget.focus();
    expect(pointerTarget.tabIndex).toBe(0);
    key("Backspace");
    expect(root.textContent).toContain("Doll Spotlight");
  });

  it("reports broken images visibly", () => {
    click("Start game");
    root.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load",
    );
  });

  it("only offers Kodi quit guidance when launched with the Kodi flag", () => {
    cleanup();
    cleanup = mountApp(root, manifest, { kodi: true });
    click("Quit to Kodi");
    expect(root.textContent).toContain("configured browser-exit shortcut");
    click("Back to game");
    expect(root.textContent).toContain("Doll Spotlight");
  });

  it("treats manifest strings as text, not HTML", () => {
    cleanup();
    cleanup = mountApp(root, {
      ...manifest,
      title: "<img src=x onerror=alert(1)>",
    });
    expect(root.querySelector("h1")?.textContent).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });

  it("requests fullscreen and landscape lock on mobile when clicking Show full Golu or Start game", () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lockOrientation = vi.fn().mockResolvedValue(undefined);
    const originalMatchMedia = window.matchMedia;
    const originalRequestFullscreen =
      document.documentElement.requestFullscreen;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      writable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(window.screen, "orientation", {
      configurable: true,
      writable: true,
      value: { lock: lockOrientation },
    });

    try {
      click("Show full Golu");
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
      expect(lockOrientation).toHaveBeenCalledWith("landscape");

      click("Start game");
      expect(requestFullscreen).toHaveBeenCalledTimes(2);
      expect(lockOrientation).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        configurable: true,
        writable: true,
        value: originalRequestFullscreen,
      });
    }
  });
});
