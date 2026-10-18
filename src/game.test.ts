import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { parseManifest } from "./manifest";
import demo from "../public/demo/questions.json";

const pack = parseManifest(demo).packs[0]!;

describe("round state machine", () => {
  it("scores once, reveals answers, then finishes the selected round", () => {
    const game = new Game();
    expect(game.phase).toBe("TITLE_SCREEN");
    game.start(pack, 2);
    expect(game.phase).toBe("QUESTION_ACTIVE");
    game.next();
    expect(game.index).toBe(0);
    game.answer(game.current.correctIndex);
    game.answer(game.current.correctIndex);
    expect(game.score).toBe(1);
    expect(game.phase).toBe("ANSWER_REVEAL");
    game.next();
    expect(game.phase).toBe("QUESTION_ACTIVE");
    game.answer((game.current.correctIndex + 1) % 4);
    game.next();
    expect(game.phase).toBe("GAME_OVER");
    expect(game.score).toBe(1);
    game.start(pack, 10);
    expect(game.questions).toHaveLength(3);
    expect(game.score).toBe(0);
    game.menu();
    expect(game.phase).toBe("TITLE_SCREEN");
    expect(game.questions).toHaveLength(0);
  });

  it("rejects invalid round lengths and answers", () => {
    const game = new Game();
    for (const length of [0, -1, 1.5, NaN]) {
      expect(() => game.start(pack, length)).toThrow();
    }
    expect(() => game.start({ ...pack, questions: [] }, 1)).toThrow();
    game.start(pack, 1);
    for (const index of [-1, 4, NaN, 0.5]) {
      expect(() => game.answer(index)).toThrow();
    }
    expect(game.phase).toBe("QUESTION_ACTIVE");
  });
});
