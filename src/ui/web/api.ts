// Talking to the server: the access token, actions over POST, live events over server-sent events.

import type { DefinitionView, FileDiffView, ProjectChangesView } from "../change-views.js";
import type { AccountUsageView } from "../plan-usage-views.js";
import type { ActionReply, ChatMessageView, ServerEvents } from "../protocol.js";

export interface HiddenLinesRequest {
  from: number;
  to: number;
  fingerprint: string;
}

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

/** Every project's uncommitted changes. */
export async function fetchChanges(): Promise<ProjectChangesView[]> {
  const res = await fetch(`/api/changes?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<ProjectChangesView[]>(await res.json());
}

/** What each account has left of its plan. */
export async function fetchPlanUsage(): Promise<AccountUsageView[]> {
  const res = await fetch(`/api/plan-usage?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<AccountUsageView[]>(await res.json());
}

/** One changed file's diff; a file that stopped being changed has none. */
export async function fetchFileDiff(project: string, path: string): Promise<FileDiffView> {
  const query = `path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(`/api/projects/${encodeURIComponent(project)}/changes/diff?${query}`);
  if (res.ok) return fromServer<FileDiffView>(await res.json());
  return { path, patch: "", notShownReason: "This file has no changes any more." };
}

/** Lines a diff left out; refuses, with the reason, when the file moved on from `request.fingerprint`. */
export async function fetchHiddenLines(project: string, path: string, request: HiddenLinesRequest): Promise<string[]> {
  const { from, to, fingerprint } = request;
  const range = `from=${from}&to=${to}&fingerprint=${encodeURIComponent(fingerprint)}`;
  const query = `path=${encodeURIComponent(path)}&${range}&token=${encodeURIComponent(token)}`;
  const res = await fetch(`/api/projects/${encodeURIComponent(project)}/changes/lines?${query}`);
  const reply: unknown = await res.json();
  if (!res.ok) throw new Error(fromServer<ActionReply>(reply).error ?? res.statusText);
  return fromServer<string[]>(reply);
}

/** Where a name in `file` may be defined, best first. */
export async function fetchDefinitions(project: string, symbol: string, file: string): Promise<DefinitionView[]> {
  const query = `symbol=${encodeURIComponent(symbol)}&file=${encodeURIComponent(file)}`;
  const url = `/api/projects/${encodeURIComponent(project)}/definitions?${query}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<DefinitionView[]>(await res.json());
}

/** A report the page makes on its own, which may outlive the page; a failure is not yours to see. */
export function report(path: string, body: object): void {
  void fetch(path, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json", "x-token": token },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** Where the page loads an attached image from. */
export function attachedImageUrl(path: string): string {
  return `/api/attachments?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
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
