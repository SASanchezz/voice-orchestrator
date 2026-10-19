import { VOICE_MESSAGE_WAIT_MS } from "../attachments/attachment-limits.js";
import type { AppEvent } from "../events/app-events.js";
import { ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { inputFor } from "../orchestrator/conversation/event-inputs.js";
import { EventTurns } from "../orchestrator/conversation/event-turns.js";
import { EventVoices } from "../orchestrator/conversation/event-voices.js";
import { InputDispatcher } from "../orchestrator/conversation/input-dispatcher.js";
import { InputQueue } from "../orchestrator/conversation/input-queue.js";
import { Notices } from "../orchestrator/conversation/notices.js";
import { OperatorLoop } from "../orchestrator/conversation/operator-loop.js";
import { QuestionGate } from "../orchestrator/conversation/question-gate.js";
import { ReplyPresenter } from "../orchestrator/conversation/reply-presenter.js";
import { ReplySpeaker } from "../orchestrator/conversation/reply-speaker.js";
import { SpeechOutput } from "../orchestrator/conversation/speech-output.js";
import { TurnContext } from "../orchestrator/conversation/turn-context.js";
import { TurnTaker } from "../orchestrator/conversation/turn-taker.js";
import { UserTurns } from "../orchestrator/conversation/user-turns.js";
import { VoiceCancel } from "../orchestrator/conversation/voice-cancel.js";
import { VoiceHold } from "../orchestrator/conversation/voice-hold.js";
import { ContextReset } from "../orchestrator/lifecycle/context-reset.js";
import { ResetRequests } from "../orchestrator/lifecycle/reset-requests.js";
import { ResetSchedule } from "../orchestrator/lifecycle/reset-schedule.js";
import { SessionLifecycle } from "../orchestrator/lifecycle/session-lifecycle.js";
import { ConversationMemory } from "../orchestrator/memory/conversation-memory.js";
import type { OperatorSession } from "../orchestrator/model/operator-session.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import type { OperatorTools } from "../orchestrator/tools/operator-tools.js";
import type { PermissionParts } from "./build-permissions.js";
import type { Core } from "./core.js";
import { buildOperatorSession } from "./operator-session.js";
import { buildOperatorTools } from "./operator-tools.js";
import type { ConversationKit, OperatorDevices, OperatorNeighbors } from "./operator-types.js";

export interface OperatorParts {
  orchestrator: Orchestrator;
  session: OperatorSession;
  lifecycle: SessionLifecycle;
  lines: ConversationLines;
  tools: OperatorTools;
  context: TurnContext;
  /** The voice of each event with a pop-up, which clicking the pop-up silences. */
  voices: EventVoices;
  /** Your spoken messages, each waiting while a page asks whether the files in its draft go with it. */
  voiceHold: VoiceHold;
  /** Takes back your newest voice message before the operator starts on it. */
  voiceCancel: VoiceCancel;
}

/** Builds the operator and has it listen: your key press, your words, and every app event. */
export function buildOperator(core: Core, neighbors: OperatorNeighbors): OperatorParts {
  const kit = conversationKit(core, neighbors);
  const tools = buildOperatorTools(core, neighbors, kit);
  const session = buildOperatorSession(core, neighbors, { kit, tools });
  const { loop, lifecycle } = operatorLoop(core, neighbors.permissions, { kit, session });
  const voiceHold = new VoiceHold(loop, VOICE_MESSAGE_WAIT_MS);
  const voiceCancel = new VoiceCancel(neighbors.devices.voice, voiceHold, kit.queue);
  listen(neighbors.devices, voiceHold, kit.context);
  core.events.on("event", (e: AppEvent) => loop.enqueue(inputFor(e, kit.voices)));
  core.events.on("permission_closed", (requestId: string) => kit.replies.answered(requestId));
  const orchestrator = new Orchestrator(loop, kit.context, kit.speech);
  const { lines, context, voices } = kit;
  return { orchestrator, session, lifecycle, lines, tools, context, voices, voiceHold, voiceCancel };
}

function conversationKit({ cfg }: Core, { permissions, devices }: OperatorNeighbors): ConversationKit {
  const gate = new QuestionGate(devices.voice, permissions.waiting, cfg.orchestrator);
  const queue = new InputQueue(gate);
  const speech = new SpeechOutput(devices.voice, cfg.voice.speak);
  const replies = new ReplySpeaker(devices.voice, permissions.waiting);
  const memory = new ConversationMemory();
  const context = new TurnContext(queue);
  return {
    gate,
    queue,
    context,
    speech,
    replies,
    voices: new EventVoices(devices.voice),
    lines: new ConversationLines(),
    memory,
    requests: new ResetRequests(),
  };
}

function operatorLoop(
  { cfg }: Core,
  { waiting }: PermissionParts,
  { kit, session }: { kit: ConversationKit; session: OperatorSession },
): { loop: OperatorLoop; lifecycle: SessionLifecycle } {
  const { gate, speech, memory, context, requests } = kit;
  const turns = new TurnTaker(new ReplyPresenter(session, kit.replies, kit.lines), memory, context);
  const reset = new ContextReset(session, memory, requests);
  const lifecycle = new SessionLifecycle(requests, new ResetSchedule(cfg.orchestrator, session, waiting), reset);
  const dispatcher = new InputDispatcher({
    user: new UserTurns(turns, gate, speech),
    event: new EventTurns(turns, gate, speech),
    notice: new Notices(speech, context),
    clear: reset,
  });
  return { loop: new OperatorLoop(kit.queue, dispatcher, lifecycle), lifecycle };
}

function listen({ voice, screen }: OperatorDevices, voiceHold: VoiceHold, context: TurnContext): void {
  voice.onPress(() => screen.capture()); // what you're looking at when you start asking, not seconds later
  context.onTurnEnd((startedAt) => screen.releaseShotsBefore(startedAt)); // the reply is done with them
  voice.onUtterance((text) => voiceHold.receive(text));
}
