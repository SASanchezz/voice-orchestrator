// Drag handles on the borders between the page's panels. A handle sets its panel's width in a CSS variable on the
// layout, which the stylesheets size the panel and place the handle by, and this browser remembers the width.

import { clampPanelWidth, parsePanelWidth } from "../panel-width.js";
import { bySelector, localRead, localWrite } from "./dom.js";

interface ResizablePanel {
  /** The handle's data-panel value in index.html, also part of the remembered width's key. */
  name: string;
  selector: string;
  variable: string;
}

const PANELS: ResizablePanel[] = [
  { name: "chat", selector: ".chat-panel", variable: "--chat-width" },
  { name: "detail", selector: "#detail", variable: "--detail-width" },
];

const RESIZING_CLASS = "resizing";

export function wirePanelResize(): void {
  const layout = bySelector("main.layout", HTMLElement);
  for (const panel of PANELS) new PanelHandle(layout, panel).wire();
}

class PanelHandle {
  private readonly handle: HTMLElement;
  private startX = 0;
  private startWidth = 0;
  private width: number | undefined;

  constructor(
    private readonly layout: HTMLElement,
    private readonly panel: ResizablePanel,
  ) {
    this.handle = bySelector(`.resize-handle[data-panel="${panel.name}"]`, HTMLElement);
  }

  wire(): void {
    const saved = parsePanelWidth(localRead(this.storageKey()));
    if (saved !== undefined) this.resize(saved);
    this.handle.addEventListener("pointerdown", this.begin);
  }

  private readonly begin = (event: PointerEvent): void => {
    event.preventDefault(); // no text selection while dragging
    this.startX = event.clientX;
    this.startWidth = bySelector(this.panel.selector, HTMLElement).getBoundingClientRect().width;
    this.handle.setPointerCapture(event.pointerId);
    this.layout.classList.add(RESIZING_CLASS);
    this.handle.addEventListener("pointermove", this.drag);
    this.handle.addEventListener("lostpointercapture", this.end, { once: true });
  };

  private readonly drag = (event: PointerEvent): void => {
    this.resize(clampPanelWidth(this.startWidth + this.startX - event.clientX)); // both panels sit on the right
  };

  private readonly end = (): void => {
    this.handle.removeEventListener("pointermove", this.drag);
    this.layout.classList.remove(RESIZING_CLASS);
    if (this.width !== undefined) localWrite(this.storageKey(), String(this.width));
  };

  private resize(width: number): void {
    this.width = width;
    this.layout.style.setProperty(this.panel.variable, `${width}px`);
  }

  private storageKey(): string {
    return `panel-width:${this.panel.name}`;
  }
}
