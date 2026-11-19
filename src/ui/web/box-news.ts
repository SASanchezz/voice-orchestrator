// What the server says about the recording meant for this page's message box, however it was started. When you send
// by voice (the talk key again, or "finish"), the box sends itself, to the session in front when you started.

import type { VoiceBoxEvent } from "../voice-box-protocol.js";
import { onServerEvent } from "./api.js";
import { PAGE_ID } from "./page-id.js";
/** The parts of a message box a recording fills. */
export interface SpokenBox {
  follow(destination: string): void;
  showWords(words: string): void;
  endWith(words: string): void;
}

/** Where the box's spoken words go: `session`, or the assistant when there is none. */
export interface SpokenTarget {
  /** Said beside the box while you talk; "" says nothing. */
  describe(session: string | undefined): string;
  /** Sends what the box holds there. */
  send(session: string | undefined): void;
}

type Handlers = { [K in VoiceBoxEvent["kind"]]: (event: Extract<VoiceBoxEvent, { kind: K }>) => void };

export class BoxNews {
  private session?: string;
  private handlers: Handlers = {
    started: ({ session }) => this.started(session),
    words: ({ words }) => this.box.showWords(words),
    send: ({ words }) => this.send(words),
    kept: ({ words }) => this.box.endWith(words),
    ended: () => this.box.endWith(""),
    cancelled: () => this.box.endWith(""),
  };

  constructor(
    private box: SpokenBox,
    private target: SpokenTarget,
  ) {}

  /** The session in front when the latest recording started, or none when it was the assistant. */
  startedIn(): string | undefined {
    return this.session;
  }

  /** Every recording meant for this page; the main page routes them itself, so a drafted reply can take one. */
  follow(events: EventSource): void {
    onServerEvent(events, "voice_box", ({ page, event }) => {
      if (page === PAGE_ID) this.receive(event);
    });
  }

  receive<K extends VoiceBoxEvent["kind"]>(event: Extract<VoiceBoxEvent, { kind: K }>): void {
    const handle: (event: Extract<VoiceBoxEvent, { kind: K }>) => void = this.handlers[event.kind];
    handle(event);
  }

  private started(session: string | undefined): void {
    this.session = session;
    this.box.follow(this.target.describe(session));
  }

  private send(words: string): void {
    this.box.endWith(words);
    this.target.send(this.session);
  }
}
