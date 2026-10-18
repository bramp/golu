import { Game } from "./game";
import type { Manifest, Question, Region } from "./manifest";
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

export function regionTransform(region?: Region): string {
  if (!region) return "translate(0%, 0%) scale(1)";
  const scale = Math.min(
    4,
    Math.max(1.2, 0.85 / Math.max(region.width, region.height)),
  );
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const translateX = (0.5 - centerX) * 100 * scale;
  const translateY = (0.5 - centerY) * 100 * scale;
  return `translate(${translateX.toFixed(2)}%, ${translateY.toFixed(2)}%) scale(${scale.toFixed(2)})`;
}

export function mountApp(
  root: HTMLElement,
  manifest: Manifest,
  {
    demo = false,
    kodi = false,
    base = "./",
    kioskIntervalMs = 8000,
  }: {
    demo?: boolean;
    kodi?: boolean;
    base?: string;
    kioskIntervalMs?: number;
  } = {},
): () => void {
  const game = new Game();
  const pack = manifest.packs[0]!;
  let kioskIndex = 0;
  let quitting = false;
  let kioskTimer: ReturnType<typeof setInterval> | undefined;

  function mediaUrl(path: string): string {
    return new URL(path.replace(/^\//, ""), new URL(base, document.baseURI))
      .href;
  }

  function clearKioskTimer(): void {
    if (kioskTimer !== undefined) {
      clearInterval(kioskTimer);
      kioskTimer = undefined;
    }
  }

  function startKioskTimer(): void {
    clearKioskTimer();
    if (game.phase === "KIOSK_MODE" && !quitting && kioskIntervalMs > 0) {
      kioskTimer = setInterval(() => {
        kioskIndex = (kioskIndex + 1) % pack.questions.length;
        render(false);
      }, kioskIntervalMs);
    }
  }

  function startGame(): void {
    clearKioskTimer();
    game.start(pack);
    render();
  }

  function returnToKiosk(): void {
    quitting = false;
    game.kiosk();
    render();
  }

  function nextDoll(): void {
    kioskIndex = (kioskIndex + 1) % pack.questions.length;
    render();
  }

  function renderStage(
    question: Question,
    altText: string,
    zoomed = true,
  ): HTMLElement {
    const stage = element("div", undefined, "golu-stage");
    const image = element("img", undefined, "golu-image");
    image.src = mediaUrl(manifest.image ?? question.image);
    image.alt = altText;
    image.dataset.zoomed = zoomed && question.region ? "true" : "false";
    image.style.transform = zoomed
      ? regionTransform(question.region)
      : regionTransform(undefined);
    image.addEventListener("error", () => {
      const message = element(
        "p",
        `Could not load the question image: ${question.image}`,
        "error",
      );
      message.role = "alert";
      stage.replaceWith(message);
    });
    stage.append(image);
    return stage;
  }

  function render(resetFocus = true): void {
    root.replaceChildren();
    root.append(element("p", "GOLU / PHOTO TRIVIA", "eyebrow"));
    if (quitting) {
      clearKioskTimer();
      root.append(
        element("h1", "Return to Kodi"),
        element(
          "p",
          "Use your configured browser-exit shortcut or launcher to close this window. " +
            "Browsers do not reliably allow a web page to close a kiosk window.",
        ),
        button("Back to game", returnToKiosk),
      );
      focusFirst(root);
      return;
    }

    if (game.phase === "KIOSK_MODE") {
      const spotlight = pack.questions[kioskIndex % pack.questions.length]!;
      const dollName =
        spotlight.name ?? spotlight.options[spotlight.correctIndex]!;
      root.append(element("h1", manifest.title));
      if (demo) {
        root.append(
          element(
            "p",
            "Demo pack: build your own Golu photo and doll regions with make assets.",
            "notice",
          ),
        );
      }

      const layout = element("div", undefined, "question-layout kiosk-layout");
      const stage = renderStage(spotlight, `Golu spotlight: ${dollName}`, true);
      const card = element("div", undefined, "kiosk-card");
      card.append(
        element(
          "p",
          `Doll Spotlight (${kioskIndex + 1} / ${pack.questions.length})`,
          "progress",
        ),
        element("h2", dollName),
        element("p", spotlight.explanation, "kiosk-explanation"),
      );

      const actions = element("div", undefined, "menu");
      actions.dataset.columns = "1";
      actions.append(
        button("Start game", startGame),
        button("Next doll", nextDoll),
      );
      if (kodi) {
        actions.append(
          button("Quit to Kodi", () => {
            quitting = true;
            render();
          }),
        );
      }
      card.append(actions);
      layout.append(stage, card);
      root.append(layout);
      startKioskTimer();
    } else if (game.phase === "GAME_OVER") {
      clearKioskTimer();
      const firstQuestion = pack.questions[0]!;
      root.append(
        element("h1", "That's a wrap!"),
        element(
          "p",
          `${game.score} / ${game.questions.length} correct`,
          "score",
        ),
        renderStage(firstQuestion, "Full Golu display", false),
        button("Play again", startGame),
        button("Back to kiosk", returnToKiosk),
      );
    } else {
      clearKioskTimer();
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
      const stage = renderStage(question, "Photo for this question", true);
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
      layout.append(stage, answers);
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
        "Arrow keys to move · Enter to choose · Back / Esc for kiosk",
        "hint",
      ),
    );
    if (resetFocus) {
      focusFirst(root);
    }
  }

  const cleanupNav = installNavigation(root, returnToKiosk);
  render();
  return () => {
    clearKioskTimer();
    cleanupNav();
  };
}
