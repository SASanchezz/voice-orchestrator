import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { asText } from "../shared/text.js";
import { fakeQuery, type QueryCall } from "../testing/fake-query.js";
import { testConfig } from "../testing/test-config.js";
import { CommandExplainer } from "./command-explainer.js";

const cfg = testConfig({
  profiles: { personal: { configDir: "/home/me/.claude-personal" }, work: { configDir: "/home/me/.claude-work" } },
  projects: { shop: { path: "/code/shop", profile: "work" } },
});

setStateDir(mkdtempSync(join(tmpdir(), "vo-explainer-")));

/** A model that answers every prompt with `reply`, remembering what it was asked and how. */
function fakeModel(reply: { subtype: string; result?: string }): { calls: QueryCall[]; query: QueryFn } {
  const calls: QueryCall[] = [];
  const query = fakeQuery((call) => {
    calls.push(call);
    return (async function* () {
      yield { type: "result", ...reply };
    })();
  });
  return { calls, query };
}

function explainerWith(query: QueryFn): CommandExplainer {
  return new CommandExplainer(cfg, openRegistry({ shop: "work" }, new AppEvents()).projects, query);
}

test("explainer: returns the model's plain-language explanation", async () => {
  const model = fakeModel({ subtype: "success", result: " Deletes the tmp folder. Low risk. " });
  assert.equal(await explainerWith(model.query).explain("shop", "rm -rf tmp"), "Deletes the tmp folder. Low risk.");
});

test("explainer: asks about the exact command and the project folder", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.match(asText(model.calls[0].prompt), /\/code\/shop[\s\S]*rm -rf tmp/);
});

test("explainer: runs on the project's own account", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.equal(model.calls[0].options?.env?.CLAUDE_CONFIG_DIR, "/home/me/.claude-work");
});

test("explainer: the model gets no tools and keeps no session", async () => {
  const model = fakeModel({ subtype: "success", result: "ok" });
  await explainerWith(model.query).explain("shop", "rm -rf tmp");
  assert.deepEqual([model.calls[0].options?.tools, model.calls[0].options?.persistSession], [[], false]);
});

test("explainer: a failed model run is an error, not an empty explanation", async () => {
  const model = fakeModel({ subtype: "error_max_turns" });
  await assert.rejects(explainerWith(model.query).explain("shop", "rm -rf tmp"), /explanation failed/);
});
