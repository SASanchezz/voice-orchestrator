import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import { CompactionNotes } from "./compaction-notes.js";
import type { ContextShrink } from "./context-compactor.js";
import { SessionCompaction } from "./session-compaction.js";
import { WorkerChat } from "./worker-chat.js";

const WINDOW = 200_000;
const SHRINK: ContextShrink = { conversationId: "claude-2", tokensBefore: 164_000, tokensAfter: 18_000 };

interface Compacting {
  compaction: SessionCompaction;
  sessions: Sessions;
  session: SessionState;
  commands: string[];
  said: string[];
}

function compactingWith(running: boolean, compact = recorded): Compacting {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-compaction-")));
  const { registry, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const chat = new WorkerChat();
  const said: string[] = [];
  chat.on("message", (m: { text: string }) => said.push(m.text));
  const commands: string[] = [];
  const compactor = { compact: (_session: SessionState, command: string) => compact(commands, command) };
  const runs = {
    isRunning: () => running,
    runAlone: <T>(_id: string, work: (abort: AbortController) => Promise<T>) => work(new AbortController()),
  };
  const compaction = new SessionCompaction(compactor, runs, new CompactionNotes(sessions, chat));
  return { compaction, sessions, session: registry.activeSession("webshop"), commands, said };
}

function recorded(commands: string[], command: string): Promise<ContextShrink> {
  commands.push(command);
  return Promise.resolve(SHRINK);
}

function talked({ sessions, session }: Compacting): SessionState {
  sessions.updateSession(session.id, { claudeSessionId: "claude-1", contextTokens: 164_000, contextWindow: WINDOW });
  return sessions.session(session.id);
}

test("session compaction: reports how full the context was and is", async () => {
  const compacting = compactingWith(false);
  const report = await compacting.compaction.compact(talked(compacting));
  assert.equal(report, "Compacted session 1's context from 82% to 9%.");
});

test("session compaction: says in the session's chat when it starts and when it is done", async () => {
  const compacting = compactingWith(false);
  await compacting.compaction.compact(talked(compacting));
  assert.deepEqual(compacting.said, [
    "Compacting session 1's context…",
    "Compacted session 1's context from 82% to 9%.",
  ]);
});

test("session compaction: the session keeps its new size and the conversation to resume", async () => {
  const compacting = compactingWith(false);
  await compacting.compaction.compact(talked(compacting));
  const { contextTokens, claudeSessionId } = compacting.sessions.session(compacting.session.id);
  assert.deepEqual({ contextTokens, claudeSessionId }, { contextTokens: 18_000, claudeSessionId: "claude-2" });
});

test("session compaction: passes on what the summary should keep", async () => {
  const compacting = compactingWith(false);
  await compacting.compaction.compact(talked(compacting), "the checkout test");
  assert.deepEqual(compacting.commands, ["/compact the checkout test"]);
});

test("session compaction: a working session is not compacted", async () => {
  const compacting = compactingWith(true);
  await assert.rejects(compacting.compaction.compact(talked(compacting)), /is working/);
});

test("session compaction: a session without a conversation has nothing to compact", async () => {
  const compacting = compactingWith(false);
  await assert.rejects(compacting.compaction.compact(compacting.session), /no conversation/);
});

test("session compaction: the session's tab shows it done once compacted", async () => {
  const compacting = compactingWith(false);
  await compacting.compaction.compact(talked(compacting));
  assert.equal(compacting.sessions.session(compacting.session.id).status, "done");
});

test("session compaction: a failed compaction leaves the session failed with the reason", async () => {
  const compacting = compactingWith(false, () => Promise.reject(new Error("Not enough messages to compact.")));
  await assert.rejects(compacting.compaction.compact(talked(compacting)));
  const { status, lastError } = compacting.sessions.session(compacting.session.id);
  assert.deepEqual(
    { status, lastError },
    {
      status: "failed",
      lastError: "Couldn't compact session 1's context: Not enough messages to compact.",
    },
  );
});
