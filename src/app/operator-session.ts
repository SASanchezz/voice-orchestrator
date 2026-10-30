import { AgentTurnLog } from "../orchestrator/model/agent-turn-log.js";
import { OperatorOptions } from "../orchestrator/model/operator-options.js";
import { OperatorSession } from "../orchestrator/model/operator-session.js";
import { SessionStream } from "../orchestrator/model/session-stream.js";
import { TurnReplies } from "../orchestrator/model/turn-replies.js";
import { TurnTimeline } from "../orchestrator/model/turn-timeline.js";
import { AgentPrompt } from "../orchestrator/prompt/agent-prompt.js";
import { ProjectSituation } from "../orchestrator/prompt/project-situation.js";
import { PromptBasics } from "../orchestrator/prompt/prompt-basics.js";
import { SystemPrompt } from "../orchestrator/prompt/system-prompt.js";
import type { OperatorTools } from "../orchestrator/tools/operator-tools.js";
import type { ConversationKit, OperatorNeighbors } from "./operator-types.js";
import type { Core } from "./core.js";

/** The operator's model session, run as its specialized agent, with a prompt written fresh for each new session. */
export function buildOperatorSession(
  core: Core,
  { permissions, devices }: OperatorNeighbors,
  { kit, tools }: { kit: ConversationKit; tools: OperatorTools },
): OperatorSession {
  const { cfg, status, history } = core;
  const situation = new ProjectSituation(status, history, permissions.views);
  const prompt = new SystemPrompt(new PromptBasics(cfg, devices.notes), situation, kit.memory);
  const agent = new AgentPrompt(devices.assistantAgent, prompt);
  const replies = new TurnReplies(new TurnTimeline(), new AgentTurnLog(agent.name));
  const stream = new SessionStream(new OperatorOptions(cfg, agent, tools), devices.query, replies);
  return new OperatorSession(stream, replies);
}
