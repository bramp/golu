import type { Pack, Question } from "./manifest";

export type Phase =
  "TITLE_SCREEN" | "QUESTION_ACTIVE" | "ANSWER_REVEAL" | "GAME_OVER";

export class Game {
  phase: Phase = "TITLE_SCREEN";
  questions: Question[] = [];
  index = 0;
  score = 0;
  selected: number | null = null;

  get current(): Question {
    const question = this.questions[this.index];
    if (!question) throw new Error("There is no active question.");
    return question;
  }

  start(pack: Pack, length: number): void {
    if (
      !Number.isInteger(length) ||
      length < 1 ||
      pack.questions.length === 0
    ) {
      throw new Error(
        "A round needs questions and a positive whole-number length.",
      );
    }
    this.questions = pack.questions.slice(0, length);
    this.index = 0;
    this.score = 0;
    this.selected = null;
    this.phase = "QUESTION_ACTIVE";
  }

  answer(index: number): void {
    if (this.phase !== "QUESTION_ACTIVE") return;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.current.options.length
    ) {
      throw new Error("Answer index is out of range.");
    }
    this.selected = index;
    if (index === this.current.correctIndex) this.score += 1;
    this.phase = "ANSWER_REVEAL";
  }

  next(): void {
    if (this.phase !== "ANSWER_REVEAL") return;
    if (this.index + 1 === this.questions.length) {
      this.phase = "GAME_OVER";
    } else {
      this.index += 1;
      this.selected = null;
      this.phase = "QUESTION_ACTIVE";
    }
  }

  menu(): void {
    this.phase = "TITLE_SCREEN";
    this.questions = [];
    this.score = 0;
    this.index = 0;
    this.selected = null;
  }
}
