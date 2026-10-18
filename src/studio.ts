import {
  HOST_CODE_SNIPPETS,
  HOST_STATE_DIALOGUES,
  HOST_STATE_LABELS,
  RajaBommaiHost,
  type HostState,
} from "./raja-bommai";
import { HostVoicePlayer } from "./voice";

interface VoiceSample {
  id: string;
  label: string;
  voice: string;
  rate: string;
  pitch: string;
  notes: string;
  src: string;
}

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
const voiceSamplesList = document.querySelector<HTMLElement>(
  "#voice-samples-list",
);
const stopVoiceBtn =
  document.querySelector<HTMLButtonElement>("#btn-stop-voice");
const voiceCliHint = document.querySelector<HTMLElement>("#voice-cli-hint");

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

const voicePlayer = new HostVoicePlayer(host);

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
    ?.addEventListener("click", () => {
      voicePlayer.stop();
      host.setState(state);
    });
}

talkToggleBtn?.addEventListener("click", () => {
  voicePlayer.stop();
  host.setTalking();
});

blinkBtn?.addEventListener("click", () => {
  host.triggerBlink();
});

pivotsCheckbox?.addEventListener("change", () => {
  host.setPivotsVisible(pivotsCheckbox.checked);
});

stopVoiceBtn?.addEventListener("click", () => {
  voicePlayer.stop();
  document.querySelectorAll(".voice-sample-btn").forEach((btn) => {
    btn.classList.remove("border-amber-400", "bg-slate-800");
  });
});

async function loadVoiceSamples(): Promise<void> {
  if (!voiceSamplesList) return;
  try {
    const res = await fetch("./voice_samples/samples.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      text: string;
      samples: VoiceSample[];
    };
    voiceSamplesList.replaceChildren();
    for (const sample of data.samples) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "voice-sample-btn flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 text-left transition";
      const info = document.createElement("div");
      const title = document.createElement("div");
      title.className = "text-xs font-bold text-white";
      title.textContent = `🔊 ${sample.label}`;
      const sub = document.createElement("div");
      sub.className = "text-[11px] text-slate-400";
      sub.textContent = `${sample.voice} · rate ${sample.rate} · pitch ${sample.pitch} — ${sample.notes}`;
      info.append(title, sub);
      btn.append(info);

      btn.addEventListener("click", () => {
        document.querySelectorAll(".voice-sample-btn").forEach((node) => {
          node.classList.remove("border-amber-400", "bg-slate-800");
        });
        btn.classList.add("border-amber-400", "bg-slate-800");
        if (voiceCliHint) {
          voiceCliHint.textContent = `uv run python scripts/build_assets.py --voice ${sample.voice} --rate="${sample.rate}" --pitch="${sample.pitch}"`;
        }
        if (hostDialogue) {
          hostDialogue.textContent = `"${data.text}"`;
        }
        host.setState("asking");
        voicePlayer.playSequence([`./${sample.src}`], {
          fallbackDurationMs: 2400,
          onComplete: () => {
            btn.classList.remove("border-amber-400", "bg-slate-800");
            host.setState("idle");
          },
        });
      });

      voiceSamplesList.append(btn);
    }
  } catch {
    voiceSamplesList.innerHTML =
      '<p class="text-xs text-slate-400">Run <code>uv run python scripts/compare_voices.py</code> to generate audition clips.</p>';
  }
}

void loadVoiceSamples();

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
