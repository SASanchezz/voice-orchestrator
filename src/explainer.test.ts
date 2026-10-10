import { test } from "node:test";
import assert from "node:assert/strict";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { CommandExplainer } from "./explainer.js";
import { Registry } from "./registry.js";
import type { AppConfig } from "./config.js";
import type { QueryFn } from "./workers.js";

const cfg = {
  profiles: { personal: { configDir: "/home/me/.claude-personal" }, work: { configDir: "/home/me/.claude-work" } },
  projects: { shop: { path: "/code/shop", profile: "work" } },
} as unknown as AppConfig;

/** A model that answers every prompt with `reply`, remembering what it was asked and how. */
function fakeModel(reply: { subtype: string; result?: string }) {
  const calls: { prompt: string; options: Options }[] = [];
  const query = ((call: { prompt: string; options: Options }) => {
    calls.push(call);
    return (async function* () {
      yield { type: "result", ...reply };
    })();
  }) as unknown as QueryFn;
  return { calls, query };
}

function explainerWith(query: QueryFn) {
  return new CommandExplainer(cfg, new Registry({ shop: "work" }), query);
}

test("explainer: returns the model's plain-language explanation", async () => {
  const model = fakeModel({ subtype: "success", result: " Deletes the tmp folder. Low risk. " });
  assert.equal(await explainerWith(model.query).explain("shop", "rm -rf tmp"), "Deletes the tmp folder. Low risk.");
});

test("explainer: asks about the exact command and the project folder", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.match(model.calls[0].prompt, /\/code\/shop[\s\S]*rm -rf tmp/);
});

test("explainer: runs on the project's own account", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.equal(model.calls[0].options.env?.CLAUDE_CONFIG_DIR, "/home/me/.claude-work");
});

test("explainer: the model gets no tools and keeps no session", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.deepEqual([model.calls[0].options.tools, model.calls[0].options.persistSession], [[], false]);
});

test("explainer: a failed model run is an error, not an empty explanation", async () => {
  const model = fakeModel({ subtype: "error_max_turns" });
  await assert.rejects(explainerWith(model.query).explain("shop", "rm -rf tmp"), /explanation failed/);
});
