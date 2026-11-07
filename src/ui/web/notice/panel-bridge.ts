// Talking to the native notice panel around this page: the page's natural height, so the panel fits it, and where the
// pointer is, which the panel passes on while it isn't focused (until then the page itself may not see the pointer).

interface PanelMessages {
  postMessage(message: { height: number }): void;
}

declare global {
  interface Window {
    webkit?: { messageHandlers?: { panel?: PanelMessages } };
    /** Called by the panel with the pointer's place in the page, or with nothing once it left. */
    panelPointer?: (x?: number, y?: number) => void;
  }
}

/** Told where the pointer is in the page, and when it left. */
export interface PointerListener {
  moved(x: number, y: number): void;
  left(): void;
}

export function followPointer(listener: PointerListener): void {
  window.panelPointer = (x, y) => (x === undefined || y === undefined ? listener.left() : listener.moved(x, y));
  document.addEventListener("mousemove", (e) => listener.moved(e.clientX, e.clientY));
  document.documentElement.addEventListener("mouseleave", () => listener.left());
}

/**
 * Whenever `content` (inside `scroller`) changes size, the height the page would need to show it all;
 * the panel grows to it up to its limit, and `scroller` scrolls the rest.
 */
export function reportHeight(scroller: HTMLElement, content: HTMLElement): void {
  const report = (): void => {
    const height = document.body.scrollHeight - scroller.clientHeight + scroller.scrollHeight;
    window.webkit?.messageHandlers?.panel?.postMessage({ height: Math.ceil(height) });
  };
  const observer = new ResizeObserver(report);
  observer.observe(content);
  observer.observe(document.body);
}
