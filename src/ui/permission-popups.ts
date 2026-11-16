import type { AppEvent, AppEvents, PermissionEvent } from "../events/app-events.js";
import type { Decision } from "../permissions/permission-types.js";
import { commandGlance, isCutByGlance } from "./command-glance.js";
import type { PopupActions } from "./popup-actions.js";

/** What a pop-up shows for one waiting request. */
export interface PopupContent {
  title: string;
  /** Says when Allow is the confirmation a destructive command needs; empty otherwise. */
  warning: string;
  /** The command at a glance. */
  command: string;
  /** The whole command behind a toggle; empty when the glance already shows all of it. */
  wholeCommand: string;
  allowLabel: string;
}

/** One open pop-up. */
export interface Popup {
  explain(explanation: string): void;
  close(): void;
}

/** Shows native pop-ups; `clicked` gets true for Allow, false for Deny, and `seen` your first click anywhere in one. */
export interface PopupDevice {
  open(content: PopupContent, clicked: (allowed: boolean) => void, seen: () => void): Popup;
}

/** Answers a request as a click on the web UI's buttons does. */
export interface ClickAnswers {
  answerByClick(id: string, decision: Decision): string;
}

/**
 * A native pop-up for each waiting request, so you can answer it from any app.
 * Allow counts as the confirmation a destructive command needs; it closes once answered anywhere.
 * Your first click on it, even off its buttons, stops what is being said: you are already reading it.
 */
export class PermissionPopups {
  private open = new Map<string, Popup>();
  /** The destructive verb of each open pop-up that has one, by request id. */
  private openVerbs = new Map<string, string>();

  constructor(
    private device: PopupDevice,
    private answers: ClickAnswers,
    private actions: Pick<PopupActions, "silence">,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "permission" && !e.reminder) this.show(e);
    });
    events.on("permission_explained", (id: string, explanation: string) => this.open.get(id)?.explain(explanation));
    events.on("permission_closed", (id: string) => this.close(id));
  }

  /** Whether an open pop-up's Allow already counts as saying "confirm <verb>". */
  isAsking(verb: string): boolean {
    return [...this.openVerbs.values()].includes(verb);
  }

  private show(request: PermissionEvent): void {
    const answer = (allowed: boolean) => this.answers.answerByClick(request.id, allowed ? "once" : "deny");
    const seen = () => this.actions.silence(request);
    this.open.set(request.id, this.device.open(contentFor(request), answer, seen));
    if (request.destructiveVerb) this.openVerbs.set(request.id, request.destructiveVerb);
  }

  private close(id: string): void {
    this.open.get(id)?.close();
    this.open.delete(id);
    this.openVerbs.delete(id);
  }
}

function contentFor(request: PermissionEvent): PopupContent {
  const verb = request.destructiveVerb;
  return {
    title: `${request.label} asks permission`,
    warning: verb ? `Destructive (${verb}). Allow counts as saying "confirm ${verb}".` : "",
    command: commandGlance(request.command),
    wholeCommand: isCutByGlance(request.command) ? request.command : "",
    allowLabel: verb ? `Allow ${verb}` : "Allow once",
  };
}
