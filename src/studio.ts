import {
  HOST_CODE_SNIPPETS,
  HOST_STATE_DIALOGUES,
  HOST_STATE_LABELS,
  RajaBommaiHost,
  type HostState,
} from "./raja-bommai";

const stageContainer = document.querySelector<HTMLElement>("#raja-stage");
if (!stageContainer) {
  throw new Error("Missing #raja-stage container in studio page.");
}

const activeStateBadge = document.querySelector<HTMLElement>(
  "#active-state-badge",
);
const hostDialogue = document.querySelector<HTMLElement>("#host-dialogue");
const codeInspector = document.querySelector<HTMLElement>("#code-inspector");
const talkIndicator = document.querySelector<HTMLElement>("#talk-indicator");
const talkToggleBtn =
  document.querySelector<HTMLButtonElement>("#btn-talk-toggle");
const blinkBtn = document.querySelector<HTMLButtonElement>("#btn-blink");
const pivotsCheckbox =
  document.querySelector<HTMLInputElement>("#toggle-pivots");
const copyBtn = document.querySelector<HTMLButtonElement>("#copy-btn");

const host = new RajaBommaiHost(stageContainer, {
  initialState: "idle",
  autoBlink: true,
  onStateChange(state) {
    document.querySelectorAll(".state-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.id === `btn-${state}`);
    });
    if (activeStateBadge) {
      activeStateBadge.textContent = HOST_STATE_LABELS[state];
    }
    if (hostDialogue) {
      hostDialogue.textContent = HOST_STATE_DIALOGUES[state];
    }
    if (codeInspector) {
      codeInspector.textContent = HOST_CODE_SNIPPETS[state];
    }
  },
  onTalkChange(talking) {
    if (talkIndicator) {
      talkIndicator.classList.toggle("bg-emerald-400", talking);
      talkIndicator.classList.toggle("bg-slate-500", !talking);
      talkIndicator.classList.toggle("animate-ping", talking);
    }
    if (talkToggleBtn) {
      talkToggleBtn.classList.toggle("border-emerald-500/60", talking);
      talkToggleBtn.classList.toggle("text-emerald-300", talking);
    }
  },
});

const states: HostState[] = [
  "idle",
  "wave",
  "asking",
  "thinking",
  "excited",
  "sad",
];
for (const state of states) {
  document
    .querySelector<HTMLButtonElement>(`#btn-${state}`)
    ?.addEventListener("click", () => host.setState(state));
}

talkToggleBtn?.addEventListener("click", () => {
  host.setTalking();
});

blinkBtn?.addEventListener("click", () => {
  host.triggerBlink();
});

pivotsCheckbox?.addEventListener("change", () => {
  host.setPivotsVisible(pivotsCheckbox.checked);
});

copyBtn?.addEventListener("click", () => {
  const codeText = codeInspector?.textContent ?? "";
  void navigator.clipboard?.writeText(codeText);
  copyBtn.textContent = "Copied!";
  copyBtn.classList.add("text-emerald-400", "border-emerald-500/50");
  setTimeout(() => {
    copyBtn.textContent = "Copy Snippet";
    copyBtn.classList.remove("text-emerald-400", "border-emerald-500/50");
  }, 1500);
});
