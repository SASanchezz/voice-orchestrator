import type { VoiceBoxEvent, VoiceBoxNews } from "../voice-box-protocol.js";
import type { VoiceBox } from "./voice-box.js";

/** The open pages; see LiveClients. */
export interface PageClients {
  isOpen(page: string): boolean;
  broadcast(event: "voice_box", news: VoiceBoxNews): void;
}

/** A web page's message box: the composer, or the notice panel's reply. Only that page acts on what it is told. */
class PageBox implements VoiceBox {
  constructor(
    private clients: PageClients,
    private page: string,
  ) {}

  isOpen(): boolean {
    return this.clients.isOpen(this.page);
  }

  tell(event: VoiceBoxEvent): void {
    this.clients.broadcast("voice_box", { page: this.page, event });
  }
}

/** The message box of each page, the same one each time; those of pages that closed are let go. */
export class PageBoxes {
  private boxes = new Map<string, PageBox>();

  constructor(private clients: PageClients) {}

  of(page: string): VoiceBox {
    const known = this.boxes.get(page);
    if (known) return known;
    this.forgetClosed();
    const box = new PageBox(this.clients, page);
    this.boxes.set(page, box);
    return box;
  }

  private forgetClosed(): void {
    for (const [page, box] of this.boxes) if (!box.isOpen()) this.boxes.delete(page);
  }
}
