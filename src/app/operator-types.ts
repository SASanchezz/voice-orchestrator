import type { QueryFn } from "../agent/query-fn.js";
import type { ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import type { InputQueue } from "../orchestrator/conversation/input-queue.js";
import type { QuestionGate } from "../orchestrator/conversation/question-gate.js";
import type { ReplySpeaker } from "../orchestrator/conversation/reply-speaker.js";
import type { SpeechOutput } from "../orchestrator/conversation/speech-output.js";
import type { EventVoices } from "../orchestrator/conversation/event-voices.js";
import type { TurnContext } from "../orchestrator/conversation/turn-context.js";
import type { ResetRequests } from "../orchestrator/lifecycle/reset-requests.js";
import type { AssistantNotes } from "../orchestrator/memory/assistant-notes.js";
import type { ConversationMemory } from "../orchestrator/memory/conversation-memory.js";
import type { ScreenSource } from "../screen/screen-source.js";
import type { GestureControl } from "../sensors/gesture-switch.js";
import type { VoiceIO } from "../voice/voice-io.js";
import type { PermissionParts } from "./build-permissions.js";
import type { QuestionParts } from "./build-questions.js";
import type { TodoParts } from "./build-todo.js";
import type { WorkerParts } from "./build-workers.js";

/** The outside world the operator talks through: your voice and screen, your notes and config, and the model. */
export interface OperatorDevices {
  voice: VoiceIO;
  screen: ScreenSource;
  notes: AssistantNotes;
  query: QueryFn;
  /** Camera gestures, switched on and off from the web UI. */
  gestures: GestureControl;
  /** config/config.yaml, which a removed project is taken out of. */
  configFile: string;
}

/** The parts of the app that work together with the operator. */
export interface OperatorNeighbors {
  permissions: PermissionParts;
  questions: QuestionParts;
  workers: WorkerParts;
  todo: TodoParts;
  devices: OperatorDevices;
}

/** What one conversation turn needs, shared by the turn handlers and the tools. */
export interface ConversationKit {
  gate: QuestionGate;
  queue: InputQueue;
  context: TurnContext;
  speech: SpeechOutput;
  replies: ReplySpeaker;
  voices: EventVoices;
  lines: ConversationLines;
  memory: ConversationMemory;
  requests: ResetRequests;
}
