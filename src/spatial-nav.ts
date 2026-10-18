export function focusFirst(root: HTMLElement): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(
    "button[data-nav]:not(:disabled)",
  );
  buttons.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1;
  });
  buttons[0]?.focus();
}

export function installNavigation(
  root: HTMLElement,
  onBack: () => void,
): () => void {
  function onFocus(event: FocusEvent): void {
    if (
      !(event.target instanceof HTMLButtonElement) ||
      !event.target.hasAttribute("data-nav")
    ) {
      return;
    }
    const active = event.target;
    root
      .querySelectorAll<HTMLButtonElement>("button[data-nav]")
      .forEach((button) => {
        button.tabIndex = button === active ? 0 : -1;
      });
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "Backspace" || event.key === "Escape") {
      event.preventDefault();
      onBack();
      return;
    }
    if (
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    )
      return;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        "button[data-nav]:not(:disabled)",
      ),
    );
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.findIndex(
      (button) => button === document.activeElement,
    );
    const active = buttons[Math.max(index, 0)];
    const columns = Number(
      active?.closest<HTMLElement>("[data-columns]")?.dataset.columns ?? 1,
    );
    const step =
      { ArrowUp: -columns, ArrowDown: columns, ArrowLeft: -1, ArrowRight: 1 }[
        event.key
      ] ?? 0;
    const next =
      index === -1
        ? 0
        : Math.max(0, Math.min(index + step, buttons.length - 1));
    buttons[next]?.focus();
  }

  root.addEventListener("focusin", onFocus);
  window.addEventListener("keydown", onKey);
  return () => {
    root.removeEventListener("focusin", onFocus);
    window.removeEventListener("keydown", onKey);
  };
}
