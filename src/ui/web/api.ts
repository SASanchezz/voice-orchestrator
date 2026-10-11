// Talking to the server: the access token, actions over POST, live events over server-sent events.

import type { ActionReply, ChatMessageView, ServerEvents } from "../protocol.js";

export const token = document.querySelector<HTMLMetaElement>('meta[name="ui-token"]')?.content ?? "";

async function post(path: string, body: object): Promise<string | undefined> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": token },
    body: JSON.stringify(body),
  });
  const reply = (await res.json()) as ActionReply;
  if (!res.ok) throw new Error(reply.error ?? res.statusText);
  return reply.message;
}

/** An action from a click; a refusal is shown to you, never thrown. */
export async function act(path: string, body: object = {}): Promise<string | undefined> {
  try {
    return await post(path, body);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessageView[]> {
  const res = await fetch(`/api/sessions/${sessionId}/messages?token=${encodeURIComponent(token)}`);
  return res.ok ? ((await res.json()) as ChatMessageView[]) : [];
}

export function openEvents(): EventSource {
  return new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
}

/** Listens for one kind of server event, with its payload already parsed. */
export function onServerEvent<K extends keyof ServerEvents>(events: EventSource, name: K, handle: (payload: ServerEvents[K]) => void) {
  events.addEventListener(name, (e) => handle(JSON.parse((e as MessageEvent<string>).data) as ServerEvents[K]));
}
