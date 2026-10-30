import { spawnSync } from "node:child_process";
import { loadAssistantAgent, type AssistantAgent } from "../config/assistant-agent.js";
import { ASSISTANT_AGENT_PATH } from "../config/paths.js";
import { appendAgentLog } from "../orchestrator/model/agent-log.js";
import { errorMessage } from "../shared/errors.js";

const STARTUP_BLOCKED_EXIT_CODE = 1;
const SPOKEN_FAILURE = "The assistant's agent is missing or broken, so the app did not start. The terminal says why.";

/**
 * Strict: the app doesn't start without its specialized agent. The result is logged either way; a missing or broken
 * definition is shown in the terminal, said aloud, and stops the app before anything else starts.
 */
export function requireAssistantAgent(file = ASSISTANT_AGENT_PATH): AssistantAgent {
  const agent = loadOrStop(file);
  appendAgentLog({ at: new Date().toISOString(), event: "startup", agent: agent.name, source: agent.source, ok: true });
  console.log(`✓ assistant agent "${agent.name}" loaded from ${agent.source}`);
  return agent;
}

function loadOrStop(file: string): AssistantAgent {
  try {
    return loadAssistantAgent(file);
  } catch (error) {
    return stopStartup(file, errorMessage(error));
  }
}

function stopStartup(file: string, problem: string): never {
  appendAgentLog({ at: new Date().toISOString(), event: "failed_startup", source: file, error: problem });
  console.error(
    [
      "",
      "✗ Startup stopped: the assistant's specialized agent can't be used.",
      `  ${problem}`,
      `  Fix ${file} (see agents/voice-assistant.md in git for a working one), then run npm start again.`,
      "",
    ].join("\n"),
  );
  spawnSync("say", [SPOKEN_FAILURE], { stdio: "ignore" }); // you may only be listening; missing `say` is fine
  process.exit(STARTUP_BLOCKED_EXIT_CODE);
}
