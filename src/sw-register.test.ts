import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./sw-register";

describe("registerServiceWorker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips registration when disabled", async () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    expect(await registerServiceWorker("/golu/", false)).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers sw.js resolved against the app base URL when enabled", async () => {
    const fakeRegistration = { scope: "/golu/" } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(fakeRegistration);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    const result = await registerServiceWorker("/golu/", true);
    expect(result).toBe(fakeRegistration);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]?.[0]).toContain("/golu/sw.js");
  });

  it("handles registration failures gracefully", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error("offline"));
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    expect(await registerServiceWorker("./", true)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
