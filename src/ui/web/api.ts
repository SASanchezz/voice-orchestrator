// Talking to the server: the access token, actions over POST, live events over server-sent events.

import type {
  BranchListView,
  ComparisonView,
  DefinitionView,
  FileDiffView,
  ProjectChangesView,
  RepositoryView,
} from "../change-views.js";
import type { MessengerStatusView } from "../messenger-status-views.js";
import type { AccountUsageView } from "../plan-usage-views.js";
import type { ActionReply, ChatMessageView, ServerEvents } from "../protocol.js";
import type { WakeRecordingView } from "../wake-recording-views.js";
import { PAGE_ID } from "./page-id.js";

export interface HiddenLinesRequest {
  from: number;
  to: number;
  fingerprint: string;
}

export const token = document.querySelector<HTMLMetaElement>('meta[name="ui-token"]')?.content ?? "";

/** An action whose refusal the caller shows itself; it throws with the server's reason. */
export async function post(path: string, body: object): Promise<string | undefined> {
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

/** Which messengers catch-up reads: in config.yaml and logged in. */
export async function fetchMessengerStatus(): Promise<MessengerStatusView[]> {
  const res = await fetch(`/api/messengers?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<MessengerStatusView[]>(await res.json());
}

/** Your wake word training recordings, oldest first. */
export async function fetchWakeRecordings(): Promise<WakeRecordingView[]> {
  return await replyOf<WakeRecordingView[]>(await fetch(urlOf("/api/wake-training/recordings", {})));
}

/** Where a training recording's audio is played from. */
export function wakeRecordingUrl({ label, name }: WakeRecordingView): string {
  return urlOf(`/api/wake-training/recordings/${label}/${encodeURIComponent(name)}`, {});
}

/** Where one kind of diff is read: a project's uncommitted changes, or what one of its branches adds to another. */
export interface DiffRoute {
  path: string;
  params: Record<string, string>;
}

export function changesRoute(project: string): DiffRoute {
  return { path: `${projectPath(project)}/changes`, params: {} };
}

/** An empty `repository` is the project's own folder. */
export function comparisonRoute(project: string, repository: string, { base, head }: ComparisonView): DiffRoute {
  return { path: `${projectPath(project)}/compare`, params: { base, head, repository } };
}

/** One changed file's diff; a file that stopped being changed has none. */
export async function fetchFileDiff(route: DiffRoute, path: string): Promise<FileDiffView> {
  const res = await fetch(urlOf(`${route.path}/diff`, { ...route.params, path }));
  if (res.ok) return fromServer<FileDiffView>(await res.json());
  return { path, patch: "", notShownReason: "This file has no changes any more." };
}

/** Lines a diff left out; refuses, with the reason, when the file moved on from `request.fingerprint`. */
export async function fetchHiddenLines(route: DiffRoute, path: string, request: HiddenLinesRequest): Promise<string[]> {
  const range = { from: String(request.from), to: String(request.to), fingerprint: request.fingerprint };
  const res = await fetch(urlOf(`${route.path}/lines`, { ...route.params, path, ...range }));
  return await replyOf<string[]>(res);
}

/** The project's own repository, or the ones directly inside its folder. */
export async function fetchRepositories(project: string): Promise<RepositoryView[]> {
  return await replyOf<RepositoryView[]>(await fetch(urlOf(`${projectPath(project)}/repositories`, {})));
}

/** A repository's local and remote branches. */
export async function fetchBranches(project: string, repository: string): Promise<BranchListView> {
  const res = await fetch(urlOf(`${projectPath(project)}/branches`, { repository }));
  return await replyOf<BranchListView>(res);
}

/** The files a branch changed since it left its base; refuses, with the reason, when a branch doesn't exist. */
export async function fetchComparison(
  project: string,
  repository: string,
  comparison: ComparisonView,
): Promise<ProjectChangesView> {
  const route = comparisonRoute(project, repository, comparison);
  return await replyOf<ProjectChangesView>(await fetch(urlOf(route.path, route.params)));
}

function projectPath(project: string): string {
  return `/api/projects/${encodeURIComponent(project)}`;
}

export function urlOf(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams({ ...params, token }).toString()}`;
}

/** The payload, or the server's reason for refusing. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the caller names the protocol type it receives
export async function replyOf<T>(res: Response): Promise<T> {
  const reply: unknown = await res.json();
  if (!res.ok) throw new Error(fromServer<ActionReply>(reply).error ?? res.statusText);
  return fromServer<T>(reply);
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

/** The stream says which page it is, so the server can tell this page about the recordings meant for its box. */
export function openEvents(): EventSource {
  return new EventSource(`/api/events?token=${encodeURIComponent(token)}&page=${PAGE_ID}`);
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
export function fromServer<T>(json: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above: typed by protocol.ts on the server
  return json as T;
}
