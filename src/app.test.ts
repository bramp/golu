import { afterEach, beforeEach, describe, expect, it } from "vitest";
import demo from "../public/demo/questions.json";
import { mountApp } from "./app";
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
  it("plays a whole round with reveal, scoring, replay, and main menu", () => {
    expect(root.textContent).toContain("Demo pack");
    expect(root.textContent).not.toContain("Quit to Kodi");
    click("A little outdoor adventure");
    expect(root.querySelector("img")?.src).toContain("/golu/demo/camping.svg");
    for (const question of manifest.packs[0]!.questions) {
      click(question.options[question.correctIndex]!);
      expect(root.textContent).toContain("Correct!");
      expect(root.querySelectorAll(".answers button:disabled")).toHaveLength(4);
      expect(document.activeElement?.textContent).toMatch(
        /Next question|See results/,
      );
      click(question.id === "demo-water" ? "See results" : "Next question");
    }
    expect(root.textContent).toContain("3 / 3 correct");
    click("Play again");
    expect(root.textContent).toContain("Score 0");
    key("Escape");
    expect(root.textContent).toContain("Round length");
    expect(root.textContent).not.toContain("Score 0");
  });

  it("moves focus in a 2x2 grid and keeps a single tab stop", () => {
    click("A little outdoor adventure");
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
    expect(root.textContent).toContain("Round length");
  });

  it("reports broken images visibly", () => {
    click("A little outdoor adventure");
    root.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load",
    );
  });

  it("cycles round length with remote controls", () => {
    click("Round length");
    expect(document.activeElement?.textContent).toContain("5 questions");
    click("Round length");
    expect(document.activeElement?.textContent).toContain("20 questions");
    key("ArrowDown");
    expect(document.activeElement?.textContent).toContain(
      "A little outdoor adventure",
    );
  });

  it("only offers Kodi quit guidance when launched with the Kodi flag", () => {
    cleanup();
    cleanup = mountApp(root, manifest, { kodi: true });
    click("Quit to Kodi");
    expect(root.textContent).toContain("configured browser-exit shortcut");
    click("Back to game");
    expect(root.textContent).toContain("Round length");
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
    expect(root.querySelector("img")).toBeNull();
  });
});
