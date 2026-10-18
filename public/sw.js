const CACHE_NAME = "golu-cache-v1";

async function precacheManifestAssets(cache) {
  await cache.addAll(["./", "./index.html", "./favicon.ico"]);

  let manifestUrl = "./questions.json";
  let response = await fetch(manifestUrl, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) {
    manifestUrl = "./demo/questions.json";
    response = await fetch(manifestUrl, {
      headers: { Accept: "application/json" },
    });
  }
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return;
  }

  await cache.put(manifestUrl, response.clone());
  const manifest = await response.json();
  const assetUrls = new Set();

  if (typeof manifest?.image === "string" && manifest.image) {
    assetUrls.add(`./${manifest.image.replace(/^\//, "")}`);
  }
  if (manifest?.hostAudio && typeof manifest.hostAudio === "object") {
    for (const clips of Object.values(manifest.hostAudio)) {
      if (!Array.isArray(clips)) continue;
      for (const clip of clips) {
        if (typeof clip === "string" && clip) {
          assetUrls.add(`./${clip.replace(/^\//, "")}`);
        }
      }
    }
  }
  if (Array.isArray(manifest?.packs)) {
    for (const pack of manifest.packs) {
      if (!Array.isArray(pack?.questions)) continue;
      for (const question of pack.questions) {
        if (typeof question?.image === "string" && question.image) {
          assetUrls.add(`./${question.image.replace(/^\//, "")}`);
        }
        if (question?.audio && typeof question.audio === "object") {
          for (const clip of Object.values(question.audio)) {
            if (typeof clip === "string" && clip) {
              assetUrls.add(`./${clip.replace(/^\//, "")}`);
            }
          }
        }
      }
    }
  }

  await Promise.all(
    Array.from(assetUrls, (url) => cache.add(url).catch(() => undefined)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheManifestAssets(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isImmutableAsset =
    /\/assets\/.*\.(?:webp|png|jpe?g|svg|mp3|ogg|wav|js|css)$/i.test(
      url.pathname,
    );

  // When a custom ./questions.json is not deployed (e.g. demo-only GitHub Pages),
  // loadManifest() expects a real 404 on ./questions.json when offline so it can
  // fall back to the cached ./demo/questions.json.
  const isRootQuestionsManifest =
    url.pathname.endsWith("/questions.json") &&
    !url.pathname.endsWith("/demo/questions.json");

  if (isImmutableAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (isRootQuestionsManifest) {
          return new Response(null, { status: 404, statusText: "Not Found" });
        }
        throw error;
      }
    }),
  );
});
