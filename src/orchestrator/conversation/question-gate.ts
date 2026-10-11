import type { AppConfig } from "../../config/app-config.js";
import type { WaitingRequests } from "../../permissions/waiting-requests.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import type { EventInput, Input } from "./inputs.js";

const SECOND_MS = 1000;

/** The question just asked aloud. The next notification waits for its answer so your replies are never ambiguous. */
interface OpenQuestion {
  permissionId?: string;
  /** For questions that don't block work (e.g. "want details?"): stop waiting after this. */
  until: number;
}

/** Decides when an input may go: your words first; notifications only once you're done talking and have answered. */
export class QuestionGate {
  private open?: OpenQuestion;

  constructor(
    private voice: VoiceIO,
    private waiting: WaitingRequests,
    private settings: AppConfig["orchestrator"],
  ) {}

  isReady(input: Input): boolean {
    if (input.kind === "user" || input.kind === "clear") return true;
    if (this.voice.isListening()) return false;
    if (!this.isOpen()) return true;
    // a reminder of the very question you're being asked may repeat it
    return input.kind === "event" && !!input.permissionId && input.permissionId === this.open?.permissionId;
  }

  /** The notification was just put to you aloud; the next one waits for your answer. */
  askedAbout(input: EventInput): void {
    this.open = { permissionId: input.permissionId, until: Date.now() + this.settings.answerWindowSeconds * SECOND_MS };
  }

  /** You spoke, which answers whatever was asked. */
  answered(): void {
    this.open = undefined;
  }

  /** A queued reminder for a request that was answered (or stopped) meanwhile. */
  isAlreadyAnswered(input: EventInput): boolean {
    return !!input.permissionId && !this.waiting.isPending(input.permissionId);
  }

  private isOpen(): boolean {
    if (!this.open) return false;
    const { permissionId, until } = this.open;
    return permissionId ? this.waiting.isPending(permissionId) : Date.now() < until;
  }
}
