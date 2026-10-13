import type { SessionLink } from "../../events/app-events.js";
import type { SingleVoice } from "./single-voice.js";

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
  /** The session whose finished task this is; the model's reply relays its answer. */
  session?: SessionLink;
  urgent: boolean;
  /** A task's short spoken outcome, said before the model's turn. */
  announcement?: string;
  /** A task's one voice, which clicking its pop-up silences. */
  voice?: SingleVoice;
}

/** Said once and shown, without a model turn; the model hears of it with your next message. */
export interface NoticeInput {
  kind: "notice";
  text: string;
  spoken: string;
  /** For a worker's questions: clicking their pop-up silences this. */
  voice?: SingleVoice;
}

/** A request to clear the conversation, keeping a handoff; queued so it runs after what you already said. */
export interface ClearInput {
  kind: "clear";
  saved: () => void;
  failed: (error: unknown) => void;
}

export type Input = UserInput | EventInput | NoticeInput | ClearInput;
