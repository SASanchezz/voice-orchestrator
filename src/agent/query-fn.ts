import type { query } from "@anthropic-ai/claude-agent-sdk";

/** The Agent SDK's query(); tests pass a scripted fake. */
export type QueryFn = typeof query;
