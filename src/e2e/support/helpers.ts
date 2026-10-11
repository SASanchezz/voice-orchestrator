import assert from "node:assert/strict";
import { isRecord } from "../../shared/records.js";
import { app, uiToken, uiUrl, voice } from "./harness.js";

const POLL_MS = 20;
const DEFAULT_WAIT_MS = 4000;

export const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Where the spoken log stands now; later checks look only at what was said after it. */
export const mark = (): number => voice.spoken.length;

export const countSince = (from: number, re: RegExp): number =>
  voice.spoken.slice(from).filter((s) => re.test(s)).length;

/** Wait until `re` has been spoken `times` times since index `from`. */
export async function heardTimes(re: RegExp, times: number, from: number): Promise<void> {
  const end = Date.now() + DEFAULT_WAIT_MS;
  while (countSince(from, re) < times && Date.now() < end) await pause(POLL_MS);
  assert.equal(countSince(from, re), times, `expected ${re} ${times} times`);
}

export async function feedHas(re: RegExp): Promise<void> {
  const end = Date.now() + DEFAULT_WAIT_MS;
  while (Date.now() < end) {
    if (app.ui.feed.recent().some((e) => re.test(e.text))) return;
    await pause(POLL_MS);
  }
  throw new Error(`Feed never showed ${re}`);
}

/** Wait until a session's chat has a message matching `re`. */
export async function chatHas(sessionId: string, re: RegExp): Promise<void> {
  const end = Date.now() + DEFAULT_WAIT_MS;
  while (Date.now() < end) {
    if (app.ui.chats.messagesOf(sessionId).some((m) => re.test(m.text))) return;
    await pause(POLL_MS);
  }
  throw new Error(`Chat of ${sessionId} never showed ${re}`);
}

export const chatText = (sessionId: string): string =>
  app.ui.chats
    .messagesOf(sessionId)
    .map((m) => m.text)
    .join("\n");

export const uiPost = (path: string, body: unknown, token = uiToken): Promise<Response> =>
  fetch(new URL(path, uiUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": token },
    body: JSON.stringify(body),
  });

export async function untilIdle(project: string): Promise<void> {
  while (app.workers.control.isBusy(project)) await pause(POLL_MS);
}

/** Wait until the operator has started a session after the `before`-th. */
export async function nextOperatorSession(sessions: unknown[], before: number): Promise<void> {
  const end = Date.now() + 3000;
  while (sessions.length === before && Date.now() < end) await pause(POLL_MS);
}

/** The first piece of a streamed response, as text; the stream is then closed. */
export async function firstChunk(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const read: unknown = await reader.read();
  await reader.cancel();
  const value = isRecord(read) ? read.value : undefined;
  if (!(value instanceof Uint8Array)) throw new Error("The stream sent nothing");
  return new TextDecoder().decode(value);
}
