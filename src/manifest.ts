export interface Question {
  id: string;
  image: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface Pack {
  id: string;
  name: string;
  questions: Question[];
}

export interface Manifest {
  version: string;
  title: string;
  packs: Pack[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function question(value: unknown): value is Question {
  return (
    record(value) &&
    text(value.id) &&
    text(value.image) &&
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
    value.correctIndex < 4
  );
}

export function parseManifest(value: unknown): Manifest {
  if (
    !record(value) ||
    !text(value.version) ||
    !text(value.title) ||
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
  return { version: value.version, title: value.title, packs };
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
