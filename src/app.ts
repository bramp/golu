import { Game } from "./game";
import type { Manifest, Pack } from "./manifest";
import { focusFirst, installNavigation } from "./spatial-nav";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text: string, action: () => void): HTMLButtonElement {
  const node = element("button", text);
  node.type = "button";
  node.dataset.nav = "true";
  node.addEventListener("click", action);
  return node;
}

export function mountApp(
  root: HTMLElement,
  manifest: Manifest,
  { demo = false, kodi = false, base = "./" } = {},
): () => void {
  const game = new Game();
  let roundLength = 10;
  let lastPack: Pack | undefined;
  let quitting = false;

  function mediaUrl(path: string): string {
    return new URL(path.replace(/^\//, ""), new URL(base, document.baseURI))
      .href;
  }

  function start(pack: Pack): void {
    lastPack = pack;
    game.start(pack, roundLength);
    render();
  }

  function menu(): void {
    quitting = false;
    game.menu();
    render();
  }

  function render(): void {
    root.replaceChildren();
    root.append(element("p", "GOLU / PHOTO TRIVIA", "eyebrow"));
    if (quitting) {
      root.append(
        element("h1", "Return to Kodi"),
        element(
          "p",
          "Use your configured browser-exit shortcut or launcher to close this window. " +
            "Browsers do not reliably allow a web page to close a kiosk window.",
        ),
        button("Back to game", menu),
      );
      focusFirst(root);
      return;
    }
    if (game.phase === "TITLE_SCREEN") {
      root.append(
        element("h1", manifest.title),
        element("p", "Your memories. Everyone's guesses."),
      );
      if (demo) {
        root.append(
          element(
            "p",
            "Demo pack: build your own photo packs with make assets.",
            "notice",
          ),
        );
      }
      const actions = element("div", undefined, "menu");
      actions.dataset.columns = "1";
      actions.append(
        button(`Round length: ${roundLength} questions`, () => {
          roundLength = roundLength === 10 ? 5 : roundLength === 5 ? 20 : 10;
          render();
        }),
      );
      for (const pack of manifest.packs) {
        actions.append(
          button(
            `${pack.name} · ${Math.min(roundLength, pack.questions.length)} questions`,
            () => start(pack),
          ),
        );
      }
      if (kodi) {
        actions.append(
          button("Quit to Kodi", () => {
            quitting = true;
            render();
          }),
        );
      }
      root.append(actions);
    } else if (game.phase === "GAME_OVER") {
      root.append(
        element("h1", "That's a wrap!"),
        element(
          "p",
          `${game.score} / ${game.questions.length} correct`,
          "score",
        ),
        button("Play again", () => {
          if (lastPack) start(lastPack);
        }),
        button("Main menu", menu),
      );
    } else {
      const question = game.current;
      root.append(
        element(
          "p",
          `Question ${game.index + 1} / ${game.questions.length} · Score ${game.score}`,
          "progress",
        ),
        element("h1", question.prompt),
      );
      const layout = element("div", undefined, "question-layout");
      const image = element("img");
      image.src = mediaUrl(question.image);
      image.alt = "Photo for this question";
      image.addEventListener("error", () => {
        const message = element(
          "p",
          `Could not load the question image: ${question.image}`,
          "error",
        );
        message.role = "alert";
        image.replaceWith(message);
      });
      const answers = element("div", undefined, "answers");
      answers.dataset.columns = "2";
      question.options.forEach((option, index) => {
        const answer = button(option, () => {
          game.answer(index);
          render();
        });
        if (game.phase === "ANSWER_REVEAL") {
          answer.disabled = true;
          if (index === question.correctIndex) {
            answer.className = "correct";
            answer.append(element("span", " · Correct"));
          } else if (index === game.selected) {
            answer.className = "incorrect";
            answer.append(element("span", " · Your answer"));
          }
        }
        answers.append(answer);
      });
      layout.append(image, answers);
      root.append(layout);
      if (game.phase === "ANSWER_REVEAL") {
        root.append(
          element(
            "p",
            game.selected === question.correctIndex ? "Correct!" : "Not quite!",
            "result",
          ),
          element("p", question.explanation),
          button(
            game.index + 1 === game.questions.length
              ? "See results"
              : "Next question",
            () => {
              game.next();
              render();
            },
          ),
        );
      }
      const nextQuestion = game.questions[game.index + 1];
      if (nextQuestion) new Image().src = mediaUrl(nextQuestion.image);
    }
    root.append(
      element(
        "p",
        "Arrow keys to move · Enter to choose · Back / Esc for menu",
        "hint",
      ),
    );
    focusFirst(root);
  }

  const cleanup = installNavigation(root, menu);
  render();
  return cleanup;
}
