import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Registry } from "../registry/registry.js";
import type { Sessions } from "../registry/sessions.js";
import { SessionHandoff } from "./session-handoff.js";
import { SessionSuccessor } from "./session-successor.js";
import { type SessionMessage, WorkerChat } from "./worker-chat.js";

const SUMMARY = "Goal: resend countdown. Done: the timer. Next: tests.";

interface Handed {
  handoff: SessionHandoff;
  registry: Registry;
  sessions: Sessions;
  said: SessionMessage[];
}

function handOffWith(running: boolean): Handed {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-handoff-")));
  const { registry, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const chat = new WorkerChat();
  const said: SessionMessage[] = [];
  chat.on("message", (m: SessionMessage) => said.push(m));
  const writer = { write: () => Promise.resolve(SUMMARY) };
  const runs = { isRunning: () => running };
  const handoff = new SessionHandoff(writer, runs, new SessionSuccessor(registry, sessions, chat));
  return { handoff, registry, sessions, said };
}

function talkedSession(registry: Registry, sessions: Sessions) {
  const session = registry.activeSession("webshop");
  sessions.updateSession(session.id, { claudeSessionId: "claude-1" });
  return session;
}

test("session handoff: a new session becomes the project's active one, carrying the summary", async () => {
  const { handoff, registry, sessions } = handOffWith(false);
  await handoff.handOff(talkedSession(registry, sessions));
  assert.equal(registry.activeSession("webshop").handoff, SUMMARY);
});

test("session handoff: the summary shows in the new session's chat", async () => {
  const { handoff, registry, sessions, said } = handOffWith(false);
  await handoff.handOff(talkedSession(registry, sessions));
  assert.deepEqual(said, [
    { session: registry.activeSession("webshop").id, kind: "status", text: `Handoff from session 1:\n\n${SUMMARY}` },
  ]);
});

test("session handoff: the old session stays as it was", async () => {
  const { handoff, registry, sessions } = handOffWith(false);
  const old = talkedSession(registry, sessions);
  await handoff.handOff(old);
  assert.equal(sessions.session(old.id).claudeSessionId, "claude-1");
});

test("session handoff: a working session is not handed off", async () => {
  const { handoff, registry, sessions } = handOffWith(true);
  await assert.rejects(handoff.handOff(talkedSession(registry, sessions)), /is working/);
});

test("session handoff: a session without a conversation has nothing to hand off", async () => {
  const { handoff, registry } = handOffWith(false);
  await assert.rejects(handoff.handOff(registry.activeSession("webshop")), /no conversation/);
});
