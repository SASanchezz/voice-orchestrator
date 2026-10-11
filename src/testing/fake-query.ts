import type { Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";

/** What the app passes to query(): a worker's instruction, or the operator's inbox. */
export interface QueryCall {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}

/** A scripted stand-in for query(): yields plain message objects shaped like the SDK's. */
export type ScriptedModel = (call: QueryCall) => AsyncIterable<object>;

/** The app only iterates what query() returns, so a scripted model can take its place. */
export function fakeQuery(model: ScriptedModel): QueryFn {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test double: it implements only the async iteration the app uses
  return model as unknown as QueryFn;
}
