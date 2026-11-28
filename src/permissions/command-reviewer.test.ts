import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { asText } from "../shared/text.js";
import { fakeQuery, type QueryCall } from "../testing/fake-query.js";
import { testConfig } from "../testing/test-config.js";
import { QuickModel } from "../workers/quick-model.js";
import { CommandReviewer } from "./command-reviewer.js";

const cfg = testConfig({
  profiles: { personal: { configDir: "/home/me/.claude-personal" } },
  projects: { shop: { path: "/code/shop", profile: "personal" } },
});
const CLEAN_BUILD = { toolName: "Bash", input: { command: "rm -rf dist" } };
const DELETE_RULE = { pattern: "rm", verb: "delete" };

setStateDir(mkdtempSync(join(tmpdir(), "vo-reviewer-")));

/** A reviewer whose model answers every prompt with `answer`, remembering the prompts. */
function reviewerAnswering(answer: string): { prompts: string[]; reviewer: CommandReviewer } {
  const prompts: string[] = [];
  const query = fakeQuery((call: QueryCall) => {
    prompts.push(asText(call.prompt));
    return (async function* () {
      yield { type: "result", subtype: "success", result: answer };
    })();
  });
  const projects = openRegistry({ shop: "personal" }, new AppEvents()).projects;
  return { prompts, reviewer: new CommandReviewer(cfg, new QuickModel(cfg, projects, query)) };
}

test("reviewer: reads the verdict out of a fenced answer", async () => {
  const { reviewer } = reviewerAnswering('```json\n{"allow": true, "reason": "build output"}\n```');
  assert.deepEqual(await reviewer.review("shop", CLEAN_BUILD, DELETE_RULE), { allow: true, reason: "build output" });
});

test("reviewer: an answer without a verdict fails", async () => {
  const { reviewer } = reviewerAnswering("Sure, looks fine.");
  await assert.rejects(reviewer.review("shop", CLEAN_BUILD, DELETE_RULE), /no verdict/);
});

test("reviewer: tells the model which destructive rule the call matched", async () => {
  const { prompts, reviewer } = reviewerAnswering('{"allow": false, "reason": "unsure"}');
  await reviewer.review("shop", CLEAN_BUILD, DELETE_RULE);
  assert.match(prompts[0], /destructive rule "delete"/);
});

test("reviewer: tells the model the project's folder", async () => {
  const { prompts, reviewer } = reviewerAnswering('{"allow": false, "reason": "unsure"}');
  await reviewer.review("shop", CLEAN_BUILD, undefined);
  assert.match(prompts[0], /\/code\/shop/);
});

test("reviewer: tells the model a rule's word may only appear in text the command writes", async () => {
  const { prompts, reviewer } = reviewerAnswering('{"allow": false, "reason": "unsure"}');
  await reviewer.review("shop", CLEAN_BUILD, DELETE_RULE);
  assert.match(prompts[0], /plain word matches/);
});
