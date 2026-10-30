import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAgentLog, type AgentLogEntry } from "./agent-log.js";
import { AgentTurnLog, type TurnMessage } from "./agent-turn-log.js";

const AGENT = "voice-assistant";

function initWith(agents: string[]): TurnMessage {
  return { type: "system", subtype: "init", agents };
}

const TURN_END: TurnMessage = { type: "result", subtype: "success" };

/** The turn's entry in the log. */
function logOfTurn(...messages: TurnMessage[]): Partial<Extract<AgentLogEntry, { event: "turn" }>> {
  const file = join(mkdtempSync(join(tmpdir(), "vo-agent-log-")), "assistant-agent.jsonl");
  const log = new AgentTurnLog(AGENT, file);
  messages.forEach((msg) => log.receive(msg));
  const [entry] = readAgentLog(file);
  return entry?.event === "turn" ? entry : {};
}

test("agent turn log: a turn whose session loaded the agent was handled by it", () => {
  const entry = logOfTurn(initWith(["general-purpose", AGENT]), TURN_END);
  assert.deepEqual([entry.agent, entry.handledBy], [AGENT, "specialized"]);
});

test("agent turn log: a turn whose session lacked the agent is logged as the fallback", () => {
  const entry = logOfTurn(initWith(["general-purpose"]), TURN_END);
  assert.deepEqual([entry.agent, entry.handledBy], ["claude", "fallback"]);
});

test("agent turn log: a turn with no session start seen counts as the fallback", () => {
  assert.equal(logOfTurn(TURN_END).handledBy, "fallback");
});

test("agent turn log: each turn is logged with its time", () => {
  const entry = logOfTurn(initWith([AGENT]), TURN_END);
  assert.equal(Number.isNaN(Date.parse(entry.at ?? "")), false);
});
