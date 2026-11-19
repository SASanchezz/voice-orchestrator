// Where the message box sends what it holds: a session's worker as a task, or the assistant, typed or spoken. A spoken
// message reaches the assistant as speech, so it answers aloud.

import type { SentFile } from "./attachments.js";
import { pickedModel } from "./composer-model.js";
import { store } from "./store.js";

export interface MessageRoute {
  path: string;
  body(text: string, attachments: SentFile[]): object;
}

const TYPED_TO_ASSISTANT: MessageRoute = {
  path: "/api/message",
  body: (text, attachments) => ({ text, attachments }),
};

const SPOKEN_TO_ASSISTANT: MessageRoute = { ...TYPED_TO_ASSISTANT, path: "/api/message/spoken" };

/** What you typed goes to the selected project's session, or else to the assistant. */
export function typedRoute(): MessageRoute {
  const project = store.selectedProject();
  return project ? sessionRoute(project.activeSession) : TYPED_TO_ASSISTANT;
}

/** What you said and sent with the Send button goes, as typed, to the session in front when you started talking. */
export function recordedRoute(session: string | undefined): MessageRoute {
  return session ? sessionRoute(session) : TYPED_TO_ASSISTANT;
}

/** What you said goes to the session in front when you started talking, or else to the assistant. */
export function spokenRoute(session: string | undefined): MessageRoute {
  return session ? sessionRoute(session) : SPOKEN_TO_ASSISTANT;
}

function sessionRoute(session: string): MessageRoute {
  return {
    path: `/api/sessions/${session}/tasks`,
    body: (instruction, attachments) => ({ instruction, attachments, model: pickedModel() }),
  };
}
