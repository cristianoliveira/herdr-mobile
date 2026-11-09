export function createPanelHistory() {
  let key: string | null = null;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => key,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    visit(next: string) {
      if (next === key) return;
      key = next;
      listeners.forEach((listener) => listener());
    },
  };
}

// Navigation memory belongs to this app run, not to saved machine settings.
export const panelHistory = createPanelHistory();

export function shouldCaptureForwardSwipe(dx: number, dy: number, startX: number, width: number, touches: number): boolean {
  return touches === 1 && startX > 24 && startX < width - 24
    && dx < -16 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function shouldOpenForwardPanel(dx: number, dy: number): boolean {
  return dx <= -80 && Math.abs(dx) > Math.abs(dy) * 2;
}
