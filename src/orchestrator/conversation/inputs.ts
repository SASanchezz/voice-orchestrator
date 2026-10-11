/** Where your words came from. Replies to typed messages are shown in the UI, not spoken. */
export type InputSource = "voice" | "ui";

export interface UserInput {
  kind: "user";
  text: string;
  source: InputSource;
}

export interface EventInput {
  kind: "event";
  text: string;
  permissionId?: string;
  urgent: boolean;
  /** A task's short spoken outcome, said before the model's turn. */
  announcement?: string;
}

/** Said once and shown, without a model turn; the model hears of it with your next message. */
export interface NoticeInput {
  kind: "notice";
  text: string;
  spoken: string;
}

/** A request to clear the conversation, keeping a handoff; queued so it runs after what you already said. */
export interface ClearInput {
  kind: "clear";
  saved: () => void;
  failed: (error: unknown) => void;
}

export type Input = UserInput | EventInput | NoticeInput | ClearInput;
