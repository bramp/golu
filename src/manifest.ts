export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuestionAudio {
  spotlight?: string;
  question?: string;
  reveal?: string;
}

export interface HostAudio {
  welcome?: string[];
  correct?: string[];
  wrong?: string[];
}

export interface Question {
  id: string;
  name?: string;
  image: string;
  region?: Region;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  audio?: QuestionAudio;
}

export interface Pack {
  id: string;
  name: string;
  questions: Question[];
}

export interface Manifest {
  version: string;
  title: string;
  image?: string;
  hostAudio?: HostAudio;
  packs: Pack[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function textList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

const QUESTION_AUDIO_KEYS = new Set(["spotlight", "question", "reveal"]);
const HOST_AUDIO_KEYS = new Set(["welcome", "correct", "wrong"]);

export function isValidQuestionAudio(value: unknown): value is QuestionAudio {
  if (!record(value)) return false;
  for (const [key, item] of Object.entries(value)) {
    if (!QUESTION_AUDIO_KEYS.has(key) || !text(item)) return false;
  }
  return true;
}

export function isValidHostAudio(value: unknown): value is HostAudio {
  if (!record(value)) return false;
  for (const [key, item] of Object.entries(value)) {
    if (!HOST_AUDIO_KEYS.has(key) || !textList(item)) return false;
  }
  return true;
}

function unitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

export function isValidRegion(value: unknown): value is Region {
  return (
    record(value) &&
    unitInterval(value.x) &&
    unitInterval(value.y) &&
    unitInterval(value.width) &&
    unitInterval(value.height) &&
    value.width > 0 &&
    value.height > 0 &&
    value.x + value.width <= 1.000001 &&
    value.y + value.height <= 1.000001
  );
}

function question(value: unknown): value is Question {
  return (
    record(value) &&
    text(value.id) &&
    (value.name === undefined || text(value.name)) &&
    text(value.image) &&
    (value.region === undefined || isValidRegion(value.region)) &&
    text(value.prompt) &&
    typeof value.explanation === "string" &&
    Array.isArray(value.options) &&
    value.options.length === 4 &&
    value.options.every(text) &&
    new Set(value.options.map((option) => option.toLowerCase().trim())).size ===
      4 &&
    typeof value.correctIndex === "number" &&
    Number.isInteger(value.correctIndex) &&
    value.correctIndex >= 0 &&
    value.correctIndex < 4 &&
    (value.audio === undefined || isValidQuestionAudio(value.audio))
  );
}

export function parseManifest(value: unknown): Manifest {
  if (
    !record(value) ||
    !text(value.version) ||
    !text(value.title) ||
    (value.image !== undefined && !text(value.image)) ||
    (value.hostAudio !== undefined && !isValidHostAudio(value.hostAudio)) ||
    !Array.isArray(value.packs) ||
    value.packs.length === 0
  ) {
    throw new Error(
      "The question manifest needs a version, title, and non-empty packs.",
    );
  }

  const packs: Pack[] = [];
  const packIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const pack of value.packs) {
    if (
      !record(pack) ||
      !text(pack.id) ||
      !text(pack.name) ||
      !Array.isArray(pack.questions) ||
      pack.questions.length === 0 ||
      packIds.has(pack.id)
    ) {
      throw new Error(
        "Each pack needs a unique ID, a name, and at least one question.",
      );
    }
    const questions: Question[] = [];
    for (const item of pack.questions) {
      if (!question(item) || questionIds.has(item.id)) {
        throw new Error(
          `Invalid or duplicate question in pack "${pack.name}".`,
        );
      }
      questionIds.add(item.id);
      questions.push(item);
    }
    packIds.add(pack.id);
    packs.push({ id: pack.id, name: pack.name, questions });
  }
  const result: Manifest = {
    version: value.version,
    title: value.title,
    packs,
  };
  if (typeof value.image === "string") {
    result.image = value.image;
  }
  if (value.hostAudio !== undefined) {
    result.hostAudio = value.hostAudio;
  }
  return result;
}

export async function loadManifest(
  base: string,
): Promise<{ manifest: Manifest; demo: boolean }> {
  let response = await fetch(`${base}questions.json`, {
    headers: { Accept: "application/json" },
  });
  const demo = response.status === 404;
  if (demo) {
    response = await fetch(`${base}demo/questions.json`, {
      headers: { Accept: "application/json" },
    });
  }
  if (!response.ok)
    throw new Error(`Could not load questions (HTTP ${response.status}).`);
  // Some development/static servers return the HTML app shell for missing JSON files.
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "Expected questions.json, but the server returned a non-JSON response.",
    );
  }
  return { manifest: parseManifest(await response.json()), demo };
}
