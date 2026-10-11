import type { AppEvent, AppEvents, PermissionEvent } from "../events/app-events.js";
import type { Decision } from "../permissions/permission-types.js";

/** What a pop-up shows for one waiting request. */
export interface PopupContent {
  title: string;
  /** Says when Allow is the confirmation a destructive command needs; empty otherwise. */
  warning: string;
  command: string;
  allowLabel: string;
}

/** One open pop-up. */
export interface Popup {
  explain(explanation: string): void;
  close(): void;
}

/** Shows native pop-ups; `clicked` gets true for Allow, false for Deny. */
export interface PopupDevice {
  open(content: PopupContent, clicked: (allowed: boolean) => void): Popup;
}

/** Answers a request as a click on the web UI's buttons does. */
export interface ClickAnswers {
  answerByClick(id: string, decision: Decision): string;
}

/**
 * A native pop-up for each waiting request, so you can answer it from any app.
 * Allow counts as the confirmation a destructive command needs, like the web UI's dialog; it closes once answered anywhere.
 */
export class PermissionPopups {
  private open = new Map<string, Popup>();

  constructor(
    private device: PopupDevice,
    private answers: ClickAnswers,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "permission" && !e.reminder) this.show(e);
    });
    events.on("permission_explained", (id: string, explanation: string) => this.open.get(id)?.explain(explanation));
    events.on("permission_closed", (id: string) => this.close(id));
  }

  private show(request: PermissionEvent): void {
    const answer = (allowed: boolean) => this.answers.answerByClick(request.id, allowed ? "once" : "deny");
    this.open.set(request.id, this.device.open(contentFor(request), answer));
  }

  private close(id: string): void {
    this.open.get(id)?.close();
    this.open.delete(id);
  }
}

function contentFor(request: PermissionEvent): PopupContent {
  const verb = request.destructiveVerb;
  return {
    title: `${request.label} asks permission`,
    warning: verb ? `Destructive (${verb}). Allow counts as saying "confirm ${verb}".` : "",
    command: request.description,
    allowLabel: verb ? `Allow ${verb}` : "Allow once",
  };
}
