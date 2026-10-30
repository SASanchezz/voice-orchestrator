// Folding a side panel down to a narrow lane, so VS Code in the middle gets its room. The panel's fold button on its
// border folds it and becomes the lane, which unfolds it again; this browser remembers which panels are folded.

import { bySelector, localRead, localWrite } from "./dom.js";

interface FoldablePanel {
  /** The fold button's data-panel value in index.html, also part of the remembered state's key. */
  name: string;
  /** How the button's title names the panel. */
  label: string;
}

const PANELS: FoldablePanel[] = [
  { name: "projects", label: "projects panel" },
  { name: "chat", label: "sessions and chat panel" },
];

const FOLDED = "folded";
const UNFOLDED = "unfolded";

export function wirePanelFolds(): void {
  const layout = bySelector("main.layout", HTMLElement);
  for (const panel of PANELS) new PanelFold(layout, panel).wire();
}

class PanelFold {
  private readonly button: HTMLButtonElement;

  constructor(
    private readonly layout: HTMLElement,
    private readonly panel: FoldablePanel,
  ) {
    this.button = bySelector(`.panel-fold[data-panel="${panel.name}"]`, HTMLButtonElement);
  }

  wire(): void {
    const wasFolded = localRead(this.storageKey()) === FOLDED;
    this.layout.classList.toggle(this.foldedClass(), wasFolded);
    this.renderButton();
    this.button.addEventListener("click", this.toggle);
  }

  private readonly toggle = (): void => {
    this.layout.classList.toggle(this.foldedClass());
    this.renderButton();
    localWrite(this.storageKey(), this.isFolded() ? FOLDED : UNFOLDED);
  };

  private renderButton(): void {
    const action = this.isFolded() ? "Show" : "Hide";
    const description = `${action} the ${this.panel.label}`;
    this.button.title = description;
    this.button.setAttribute("aria-label", description); // the button shows only an icon
    this.button.setAttribute("aria-expanded", String(!this.isFolded()));
  }

  private isFolded(): boolean {
    return this.layout.classList.contains(this.foldedClass());
  }

  private foldedClass(): string {
    return `${this.panel.name}-folded`;
  }

  private storageKey(): string {
    return `panel-folded:${this.panel.name}`;
  }
}
