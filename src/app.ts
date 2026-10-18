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

export function regionScale(region?: Region): number {
  if (!region) return 1;
  return Math.min(
    4,
    Math.max(1.2, 0.85 / Math.max(region.width, region.height)),
  );
}

export function regionTransform(region?: Region): string {
  if (!region) return "translate(0%, 0%) scale(1)";
  const scale = regionScale(region);
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const maxShiftX = (scale - 1) * 50;
  const maxShiftYTop = (scale - 1) * 50;
  const maxShiftYBottom = (scale - 1) * 50 + 28;
  const translateX = Math.max(
    -maxShiftX,
    Math.min(maxShiftX, (0.5 - centerX) * 100 * scale),
  );
  // Bias the zoomed region slightly above vertical center so it sits in the
  // open viewport window above the bottom HUD overlay.
  const rawTranslateY = ((0.5 - centerY) * scale - 0.1) * 100;
  const translateY = Math.max(
    -maxShiftYBottom,
    Math.min(maxShiftYTop, rawTranslateY),
  );
  return `translate(${translateX.toFixed(2)}%, ${translateY.toFixed(2)}%) scale(${scale.toFixed(2)})`;
}

const BASE_KIOSK_VIEW_MS = 6000;
const MS_PER_KIOSK_WORD = 350;
const MIN_KIOSK_DURATION_MS = 10000;
const MAX_KIOSK_DURATION_MS = 30000;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 90000;
const MOBILE_FULLSCREEN_MEDIA_QUERY = "(pointer: coarse), (max-height: 540px)";

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export function requestMobileFullscreen(): void {
  if (typeof window.matchMedia !== "function") return;
  if (!window.matchMedia(MOBILE_FULLSCREEN_MEDIA_QUERY).matches) return;

  const doc = document as FullscreenCapableDocument;
  const docEl = document.documentElement as FullscreenCapableElement | null;
  if (docEl && !doc.fullscreenElement && !doc.webkitFullscreenElement) {
    try {
      if (typeof docEl.requestFullscreen === "function") {
        void Promise.resolve(
          docEl.requestFullscreen({ navigationUI: "hide" }),
        ).catch(() => {});
      } else if (typeof docEl.webkitRequestFullscreen === "function") {
        void Promise.resolve(docEl.webkitRequestFullscreen()).catch(() => {});
      }
    } catch {
      // Ignore fullscreen errors on unsupported mobile browsers.
    }
  }

  const orientation = window.screen?.orientation as
    LockableScreenOrientation | undefined;
  if (typeof orientation?.lock === "function") {
    try {
      void Promise.resolve(orientation.lock("landscape")).catch(() => {});
    } catch {
      // Ignore orientation lock errors when unsupported or denied.
    }
  }
}

export function kioskSpotlightDurationMs(question: Question): number {
  const dollName = question.name ?? question.options[question.correctIndex]!;
  const words = `${dollName} ${question.explanation}`
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(
    MAX_KIOSK_DURATION_MS,
    Math.max(
      MIN_KIOSK_DURATION_MS,
      BASE_KIOSK_VIEW_MS + words * MS_PER_KIOSK_WORD,
    ),
  );
}

export function mountApp(
  root: HTMLElement,
  manifest: Manifest,
  {
    demo = false,
    kodi = false,
    base = "./",
    kioskIntervalMs,
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  }: {
    demo?: boolean;
    kodi?: boolean;
    base?: string;
    kioskIntervalMs?: number;
    inactivityTimeoutMs?: number;
  } = {},
): () => void {
  const game = new Game();
  const pack = manifest.packs[0]!;
  let kioskIndex = 0;
  let quitting = false;
  let peekFullGolu = false;
  let kioskTimer: ReturnType<typeof setTimeout> | undefined;
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined;

  function mediaUrl(path: string): string {
    return new URL(path.replace(/^\//, ""), new URL(base, document.baseURI))
      .href;
  }

  function clearKioskTimer(): void {
    if (kioskTimer !== undefined) {
      clearTimeout(kioskTimer);
      kioskTimer = undefined;
    }
  }

  function clearInactivityTimer(): void {
    if (inactivityTimer !== undefined) {
      clearTimeout(inactivityTimer);
      inactivityTimer = undefined;
    }
  }

  function resetInactivityTimer(): void {
    clearInactivityTimer();
    if ((game.phase !== "KIOSK_MODE" || quitting) && inactivityTimeoutMs > 0) {
      inactivityTimer = setTimeout(() => {
        returnToKiosk();
      }, inactivityTimeoutMs);
    }
  }

  function applyStageState(
    stage: HTMLElement,
    question: Question,
    altText: string,
    zoomed: boolean,
    showSpotlight: boolean,
  ): void {
    const canvas = stage.querySelector<HTMLElement>(".golu-canvas");
    const image = stage.querySelector<HTMLImageElement>(".golu-image");
    if (!canvas || !image) return;

    const isZoomed = zoomed && Boolean(question.region);
    const activeRegion = isZoomed ? question.region : undefined;
    const scale = regionScale(activeRegion);
    const transform = regionTransform(activeRegion);
    const nextSrc = mediaUrl(manifest.image ?? question.image);

    if (image.src !== nextSrc) {
      image.src = nextSrc;
    }
    stage.style.setProperty("--stage-bg", `url("${nextSrc}")`);
    image.alt = altText;
    image.dataset.zoomed = isZoomed ? "true" : "false";
    canvas.dataset.zoomed = isZoomed ? "true" : "false";
    canvas.style.setProperty("--stage-scale", scale.toFixed(2));
    canvas.style.transform = transform;

    let spotlight = canvas.querySelector<HTMLElement>(".golu-spotlight");
    if (showSpotlight && question.region) {
      if (!spotlight) {
        spotlight = element("div", undefined, "golu-spotlight");
        spotlight.setAttribute("aria-hidden", "true");
        canvas.append(spotlight);
      }
      spotlight.style.left = `${(question.region.x * 100).toFixed(2)}%`;
      spotlight.style.top = `${(question.region.y * 100).toFixed(2)}%`;
      spotlight.style.width = `${(question.region.width * 100).toFixed(2)}%`;
      spotlight.style.height = `${(question.region.height * 100).toFixed(2)}%`;
    } else {
      spotlight?.remove();
    }
  }

  function renderStage(
    question: Question,
    altText: string,
    zoomed = true,
    showSpotlight = true,
  ): HTMLElement {
    const stage = element("div", undefined, "golu-stage");
    const canvas = element("div", undefined, "golu-canvas");
    const image = element("img", undefined, "golu-image");

    image.addEventListener("load", () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        canvas.style.setProperty(
          "--img-aspect",
          (image.naturalWidth / image.naturalHeight).toFixed(4),
        );
      }
    });

    image.addEventListener("error", () => {
      const message = element(
        "p",
        `Could not load the question image: ${question.image}`,
        "error",
      );
      message.role = "alert";
      stage.replaceWith(message);
    });

    canvas.append(image);
    stage.append(canvas);
    applyStageState(stage, question, altText, zoomed, showSpotlight);
    return stage;
  }

  function updateKioskDomInPlace(): boolean {
    const stage = root.querySelector<HTMLElement>(".golu-stage");
    const card = root.querySelector<HTMLElement>(".kiosk-card");
    if (!stage || !card) return false;

    const spotlight = pack.questions[kioskIndex % pack.questions.length]!;
    const dollName =
      spotlight.name ?? spotlight.options[spotlight.correctIndex]!;
    applyStageState(
      stage,
      spotlight,
      `Golu spotlight: ${dollName}`,
      !peekFullGolu,
      true,
    );

    const progress = card.querySelector<HTMLElement>(".progress");
    const heading = card.querySelector<HTMLElement>("h2");
    const explanation = card.querySelector<HTMLElement>(".kiosk-explanation");
    const zoomBtn = card.querySelector<HTMLButtonElement>(
      'button[data-action="toggle-zoom"]',
    );
    if (progress) {
      progress.textContent = `Doll Spotlight (${kioskIndex + 1} / ${pack.questions.length})`;
    }
    if (heading) heading.textContent = dollName;
    if (explanation) explanation.textContent = spotlight.explanation;
    if (zoomBtn) {
      zoomBtn.textContent = peekFullGolu ? "Zoom to doll" : "Show full Golu";
    }
    return true;
  }

  function startKioskTimer(): void {
    clearKioskTimer();
    if (game.phase !== "KIOSK_MODE" || quitting) return;
    const spotlight = pack.questions[kioskIndex % pack.questions.length]!;
    const delayMs = kioskIntervalMs ?? kioskSpotlightDurationMs(spotlight);
    if (delayMs <= 0) return;
    kioskTimer = setTimeout(() => {
      kioskIndex = (kioskIndex + 1) % pack.questions.length;
      peekFullGolu = false;
      if (!updateKioskDomInPlace()) {
        render(false);
      } else {
        startKioskTimer();
      }
    }, delayMs);
  }

  function startGame(): void {
    requestMobileFullscreen();
    clearKioskTimer();
    peekFullGolu = false;
    game.start(pack);
    render();
  }

  function returnToKiosk(): void {
    quitting = false;
    peekFullGolu = false;
    game.kiosk();
    render();
  }

  function nextDoll(): void {
    kioskIndex = (kioskIndex + 1) % pack.questions.length;
    peekFullGolu = false;
    if (!updateKioskDomInPlace()) {
      render();
    } else {
      startKioskTimer();
    }
  }

  function togglePeek(): void {
    requestMobileFullscreen();
    peekFullGolu = !peekFullGolu;
    const stage = root.querySelector<HTMLElement>(".golu-stage");
    const zoomBtn = root.querySelector<HTMLButtonElement>(
      'button[data-action="toggle-zoom"]',
    );
    if (stage && zoomBtn) {
      const activeQuestion =
        game.phase === "KIOSK_MODE"
          ? pack.questions[kioskIndex % pack.questions.length]!
          : game.current;
      const dollName =
        activeQuestion.name ??
        activeQuestion.options[activeQuestion.correctIndex]!;
      const altText =
        game.phase === "KIOSK_MODE"
          ? `Golu spotlight: ${dollName}`
          : "Photo for this question";
      applyStageState(stage, activeQuestion, altText, !peekFullGolu, true);
      zoomBtn.textContent = peekFullGolu ? "Zoom to doll" : "Show full Golu";
      if (game.phase === "KIOSK_MODE") {
        startKioskTimer();
      }
      return;
    }
    render(false);
  }

  function zoomToggleButton(region?: Region): HTMLButtonElement | null {
    if (!region) return null;
    const btn = button(
      peekFullGolu ? "Zoom to doll" : "Show full Golu",
      togglePeek,
    );
    btn.dataset.action = "toggle-zoom";
    btn.className = "secondary-btn";
    return btn;
  }

  function render(resetFocus = true): void {
    const previousActive =
      !resetFocus &&
      document.activeElement instanceof HTMLButtonElement &&
      root.contains(document.activeElement)
        ? {
            action: document.activeElement.dataset.action,
            text: document.activeElement.textContent,
          }
        : null;

    root.replaceChildren();
    resetInactivityTimer();
    if (quitting) {
      clearKioskTimer();
      const panel = element("div", undefined, "hud-panel quit-panel");
      panel.append(
        element("p", "GOLU / PHOTO TRIVIA", "eyebrow"),
        element("h1", "Return to Kodi"),
        element(
          "p",
          "Use your configured browser-exit shortcut or launcher to close this window. " +
            "Browsers do not reliably allow a web page to close a kiosk window.",
        ),
        button("Back to game", returnToKiosk),
      );
      root.append(panel);
      focusFirst(root);
      return;
    }

    const hintText =
      "Arrow keys to move · Enter to choose · Back / Esc for kiosk";

    if (game.phase === "KIOSK_MODE") {
      const spotlight = pack.questions[kioskIndex % pack.questions.length]!;
      const dollName =
        spotlight.name ?? spotlight.options[spotlight.correctIndex]!;
      const stage = renderStage(
        spotlight,
        `Golu spotlight: ${dollName}`,
        !peekFullGolu,
        true,
      );

      const hudTop = element("header", undefined, "hud-top");
      const titleGroup = element("div", undefined, "hud-title-group");
      titleGroup.append(
        element("p", "GOLU / PHOTO TRIVIA", "eyebrow"),
        element("h1", manifest.title),
      );
      hudTop.append(titleGroup);
      if (demo) {
        hudTop.append(
          element(
            "p",
            "Demo pack: build your own Golu photo and doll regions with make assets.",
            "notice",
          ),
        );
      }

      const hudBottom = element(
        "section",
        undefined,
        "hud-bottom kiosk-layout",
      );
      const card = element("div", undefined, "kiosk-card");
      const copy = element("div", undefined, "kiosk-copy");
      copy.append(
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
      const zoomBtn = zoomToggleButton(spotlight.region);
      if (zoomBtn) actions.append(zoomBtn);
      if (kodi) {
        actions.append(
          button("Quit to Kodi", () => {
            quitting = true;
            render();
          }),
        );
      }
      card.append(copy, actions);
      hudBottom.append(card, element("p", hintText, "hint"));
      root.append(stage, hudTop, hudBottom);
      startKioskTimer();
    } else if (game.phase === "GAME_OVER") {
      clearKioskTimer();
      const firstQuestion = pack.questions[0]!;
      const stage = renderStage(
        firstQuestion,
        "Full Golu display",
        false,
        false,
      );
      const hudTop = element("header", undefined, "hud-top");
      hudTop.append(element("p", "GOLU / PHOTO TRIVIA", "eyebrow"));

      const hudBottom = element(
        "section",
        undefined,
        "hud-bottom gameover-card",
      );
      const actions = element("div", undefined, "gameover-actions");
      actions.append(
        button("Play again", startGame),
        button("Back to kiosk", returnToKiosk),
      );
      hudBottom.append(
        element("h1", "That's a wrap!"),
        element(
          "p",
          `${game.score} / ${game.questions.length} correct`,
          "score",
        ),
        actions,
        element("p", hintText, "hint"),
      );
      root.append(stage, hudTop, hudBottom);
    } else {
      clearKioskTimer();
      const question = game.current;
      const stage = renderStage(
        question,
        "Photo for this question",
        !peekFullGolu,
        true,
      );

      const hudTop = element("header", undefined, "hud-top");
      const metaRow = element("div", undefined, "hud-meta-row");
      metaRow.append(
        element("p", "GOLU / PHOTO TRIVIA", "eyebrow"),
        element(
          "p",
          `Question ${game.index + 1} / ${game.questions.length} · Score ${game.score}`,
          "progress",
        ),
      );
      hudTop.append(metaRow, element("h1", question.prompt));

      const hudBottom = element(
        "section",
        undefined,
        game.phase === "ANSWER_REVEAL"
          ? "hud-bottom question-layout is-reveal"
          : "hud-bottom question-layout",
      );
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
      hudBottom.append(answers);

      if (game.phase === "ANSWER_REVEAL") {
        const revealCard = element("div", undefined, "reveal-card");
        const revealActions = element("div", undefined, "reveal-actions");
        revealActions.append(
          button(
            game.index + 1 === game.questions.length
              ? "See results"
              : "Next question",
            () => {
              peekFullGolu = false;
              game.next();
              render();
            },
          ),
        );
        const zoomBtn = zoomToggleButton(question.region);
        if (zoomBtn) revealActions.append(zoomBtn);
        revealCard.append(
          element(
            "p",
            game.selected === question.correctIndex ? "Correct!" : "Not quite!",
            "result",
          ),
          element("p", question.explanation, "reveal-explanation"),
          revealActions,
        );
        hudBottom.append(revealCard);
      }

      const footerRow = element("div", undefined, "hud-footer-row");
      if (game.phase === "QUESTION_ACTIVE") {
        const zoomBtn = zoomToggleButton(question.region);
        if (zoomBtn) {
          const stageActions = element("div", undefined, "stage-actions");
          stageActions.append(zoomBtn);
          footerRow.append(stageActions);
        }
      }
      footerRow.append(element("p", hintText, "hint"));
      hudBottom.append(footerRow);

      root.append(stage, hudTop, hudBottom);
      const nextQuestion = game.questions[game.index + 1];
      if (nextQuestion) new Image().src = mediaUrl(nextQuestion.image);
    }
    root.append(
      (() => {
        const rotateOverlay = element("div", undefined, "rotate-overlay");
        rotateOverlay.setAttribute("aria-hidden", "true");
        const icon = element("div", "↻", "rotate-icon");
        const title = element("h2", "Rotate your phone to landscape");
        const subtitle = element(
          "p",
          "Golu Photo Trivia is designed for a widescreen view. Turn your device sideways to play.",
        );
        rotateOverlay.append(icon, title, subtitle);
        return rotateOverlay;
      })(),
    );

    if (resetFocus) {
      focusFirst(root);
    } else if (previousActive) {
      const navButtons = Array.from(
        root.querySelectorAll<HTMLButtonElement>(
          "button[data-nav]:not(:disabled)",
        ),
      );
      const restored =
        (previousActive.action
          ? navButtons.find(
              (btn) => btn.dataset.action === previousActive.action,
            )
          : undefined) ??
        navButtons.find((btn) => btn.textContent === previousActive.text) ??
        navButtons[0];
      navButtons.forEach((btn) => {
        btn.tabIndex = btn === restored ? 0 : -1;
      });
      restored?.focus();
    } else {
      focusFirst(root);
    }
  }

  const onUserActivity = (): void => {
    if (game.phase !== "KIOSK_MODE" || quitting) {
      resetInactivityTimer();
    }
  };
  window.addEventListener("keydown", onUserActivity);
  window.addEventListener("pointerdown", onUserActivity);
  window.addEventListener("touchstart", onUserActivity, { passive: true });

  const cleanupNav = installNavigation(root, returnToKiosk);
  render();
  return () => {
    clearKioskTimer();
    clearInactivityTimer();
    window.removeEventListener("keydown", onUserActivity);
    window.removeEventListener("pointerdown", onUserActivity);
    window.removeEventListener("touchstart", onUserActivity);
    cleanupNav();
  };
}
