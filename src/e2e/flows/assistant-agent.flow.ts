import { test } from "node:test";
import assert from "node:assert/strict";
import { readAgentLog, type AgentLogEntry } from "../../orchestrator/model/agent-log.js";
import { operatorSessions } from "../support/fake-operator.js";
import { voice } from "../support/harness.js";
import { pause } from "../support/helpers.js";

type TurnEntry = Extract<AgentLogEntry, { event: "turn" }>;

function loggedTurns(): TurnEntry[] {
  return readAgentLog().filter((entry): entry is TurnEntry => entry.event === "turn");
}

test("the assistant runs as the voice-assistant agent", () => {
  assert.equal(operatorSessions[0]?.agent, "voice-assistant");
});

test("the assistant's agent has the operator prompt and its own rules", () => {
  assert.match(operatorSessions[0]?.systemPrompt ?? "", /voice operator[\s\S]*## Requirement clarity/);
});

test("an assistant turn is logged as handled by the specialized agent", async () => {
  const before = loggedTurns().length;
  voice.say("hello");
  while (loggedTurns().length === before) await pause(20);
  const turn = loggedTurns().at(before);
  assert.deepEqual([turn?.agent, turn?.handledBy], ["voice-assistant", "specialized"]);
});
