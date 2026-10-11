// Talking to the server: the access token, actions over POST, live events over server-sent events.

import type { ActionReply, ChatMessageView, ServerEvents } from "../protocol.js";

export const token = document.querySelector<HTMLMetaElement>('meta[name="ui-token"]')?.content ?? "";

async function post(path: string, body: object): Promise<string | undefined> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": token },
    body: JSON.stringify(body),
  });
  const reply = fromServer<ActionReply>(await res.json());
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
  return res.ok ? fromServer<ChatMessageView[]>(await res.json()) : [];
}

export function openEvents(): EventSource {
  return new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
}

/** Listens for one kind of server event, with its payload already parsed. */
export function onServerEvent<K extends keyof ServerEvents>(
  events: EventSource,
  name: K,
  handle: (payload: ServerEvents[K]) => void,
): void {
  events.addEventListener(name, (e) => {
    if (e instanceof MessageEvent && typeof e.data === "string")
      handle(fromServer<ServerEvents[K]>(JSON.parse(e.data)));
  });
}

/**
 * Our own server's JSON. Its payloads are typed against protocol.ts, which the server and this page both
 * compile, so the two can't drift apart unnoticed; checking them again here would only repeat that.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the caller names the protocol type it receives
function fromServer<T>(json: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above: typed by protocol.ts on the server
  return json as T;
}
