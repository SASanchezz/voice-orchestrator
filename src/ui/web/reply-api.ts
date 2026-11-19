// The Messages view's reads: the drafted replies waiting for you, and the conversation one of them answers.

import type { SourceCheckup } from "../reply-checkup-views.js";
import type { ReplyContextLine, ReplyDraftView } from "../reply-views.js";
import { fromServer, token } from "./api.js";

export async function fetchReplies(): Promise<ReplyDraftView[]> {
  const res = await fetch(`/api/replies?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<ReplyDraftView[]>(await res.json());
}

/** Read from the messenger when asked; empty when it can't be read right now. */
export async function fetchReplyContext(id: string): Promise<ReplyContextLine[]> {
  const res = await fetch(`/api/replies/${encodeURIComponent(id)}/context?token=${encodeURIComponent(token)}`);
  return res.ok ? fromServer<ReplyContextLine[]>(await res.json()) : [];
}

/** Every messenger's setup, tried now; takes a few seconds while Slack answers a test connection. */
export async function fetchReplyCheckup(): Promise<SourceCheckup[]> {
  const res = await fetch(`/api/replies/checkup?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<SourceCheckup[]>(await res.json());
}
