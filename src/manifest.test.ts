import { afterEach, describe, expect, it, vi } from "vitest";
import demo from "../public/demo/questions.json";
import { loadManifest, parseManifest } from "./manifest";

afterEach(() => vi.unstubAllGlobals());

describe("manifest validation", () => {
  it("accepts the demo schema", () => {
    expect(parseManifest(demo).packs[0]?.questions).toHaveLength(3);
  });

  it("accepts optional hostAudio and per-question audio fields", () => {
    const withAudio = {
      ...demo,
      hostAudio: {
        welcome: ["assets/audio_w1.mp3"],
        correct: ["assets/audio_c1.mp3"],
        wrong: ["assets/audio_x1.mp3"],
      },
      packs: [
        {
          ...demo.packs[0],
          questions: demo.packs[0]!.questions.map((q) => ({
            ...q,
            audio: {
              spotlight: "assets/audio_s.mp3",
              question: "assets/audio_q.mp3",
              reveal: "assets/audio_r.mp3",
            },
          })),
        },
      ],
    };
    const parsed = parseManifest(withAudio);
    expect(parsed.hostAudio?.welcome).toEqual(["assets/audio_w1.mp3"]);
    expect(parsed.packs[0]?.questions[0]?.audio?.spotlight).toBe(
      "assets/audio_s.mp3",
    );
  });

  it.each([
    null,
    {},
    { ...demo, packs: [] },
    { ...demo, hostAudio: { unknown: ["assets/a.mp3"] } },
    { ...demo, hostAudio: { welcome: [""] } },
    { ...demo, packs: [...demo.packs, ...demo.packs] },
    {
      ...demo,
      packs: [
        {
          ...demo.packs[0],
          questions: [
            {
              ...demo.packs[0]!.questions[0],
              audio: { spotlight: "" },
            },
          ],
        },
      ],
    },
    {
      ...demo,
      packs: [
        {
          ...demo.packs[0],
          questions: [{ ...demo.packs[0]!.questions[0], correctIndex: 4 }],
        },
      ],
    },
    {
      ...demo,
      packs: [
        {
          ...demo.packs[0],
          questions: [
            { ...demo.packs[0]!.questions[0], options: ["A", "a", "B", "C"] },
          ],
        },
      ],
    },
    {
      ...demo,
      packs: [
        {
          ...demo.packs[0],
          questions: Array(2).fill(demo.packs[0]!.questions[0]),
        },
      ],
    },
    {
      ...demo,
      packs: [
        {
          ...demo.packs[0],
          questions: [
            {
              ...demo.packs[0]!.questions[0],
              region: { x: 0.8, y: 0.2, width: 0.4, height: 0.2 },
            },
          ],
        },
      ],
    },
  ])("rejects malformed or ambiguous data", (value) => {
    expect(() => parseManifest(value)).toThrow();
  });
});

describe("manifest loading", () => {
  it("uses demo content only when the custom manifest is absent", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(demo));
    vi.stubGlobal("fetch", fetch);
    expect((await loadManifest("/golu/")).demo).toBe(true);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/golu/questions.json",
      "/golu/demo/questions.json",
    ]);
  });

  it("loads a custom pack without requesting demo content", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(demo));
    vi.stubGlobal("fetch", fetch);
    expect((await loadManifest("./")).demo).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Response(null, { status: 500 }),
    new Response("<html>app shell</html>", {
      headers: { "content-type": "text/html" },
    }),
    Response.json({ broken: true }),
  ])(
    "surfaces failures instead of silently substituting demo content",
    async (response) => {
      const fetch = vi.fn().mockResolvedValue(response);
      vi.stubGlobal("fetch", fetch);
      await expect(loadManifest("./")).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});
