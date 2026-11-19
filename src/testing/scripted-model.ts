import { ToolFreeModel } from "../messages/replies/tool-free-model.js";
import { fakeQuery, type QueryCall } from "./fake-query.js";
import { testConfig } from "./test-config.js";

export const TWO_ACCOUNTS = testConfig({ profiles: { personal: { configDir: "/p" }, work: { configDir: "/w" } } });

/** A tool-free model whose answers the test writes, by the call's model; every call is recorded. */
export function scriptedModel(answer: (call: QueryCall) => string): { model: ToolFreeModel; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const query = fakeQuery(async function* (call) {
    calls.push(call);
    yield { type: "result", subtype: "success", result: answer(call) };
  });
  return { model: new ToolFreeModel(TWO_ACCOUNTS, query), calls };
}

export function promptOf(call: QueryCall): string {
  if (typeof call.prompt !== "string") throw new Error("expected a text prompt");
  return call.prompt;
}
