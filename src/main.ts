import { mountApp } from "./app";
import { loadManifest } from "./manifest";
import { registerServiceWorker } from "./sw-register";
import "./style.css";

void registerServiceWorker(import.meta.env.BASE_URL);

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing application root.");

try {
  const { manifest, demo } = await loadManifest(import.meta.env.BASE_URL);
  mountApp(root, manifest, {
    demo,
    kodi: new URLSearchParams(window.location.search).get("kodi") === "1",
    base: import.meta.env.BASE_URL,
  });
} catch (error) {
  console.error("Could not start Golu", error);
  const heading = document.createElement("h1");
  heading.textContent = "Couldn't load the game";
  const message = document.createElement("p");
  message.textContent = error instanceof Error ? error.message : String(error);
  const retry = document.createElement("button");
  retry.textContent = "Try again";
  retry.addEventListener("click", () => window.location.reload());
  root.replaceChildren(heading, message, retry);
  retry.focus();
}
