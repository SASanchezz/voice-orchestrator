import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { fakeQuery, type QueryCall } from "../testing/fake-query.js";
import { testConfig } from "../testing/test-config.js";
import { QuickModel } from "./quick-model.js";
import { TitleWriter } from "./title-writer.js";

const cfg = testConfig({
  profiles: { personal: { configDir: "/home/me/.claude-personal" }, work: { configDir: "/home/me/.claude-work" } },
  projects: { shop: { path: "/code/shop", profile: "work" } },
});

setStateDir(mkdtempSync(join(tmpdir(), "vo-title-writer-")));

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

function writerWith(query: QueryFn): TitleWriter {
  const { projects } = openRegistry({ shop: "work" }, new AppEvents());
  return new TitleWriter(new QuickModel(cfg, projects, query));
}

test("title writer: keeps only the first line of the reply, without quotes or full stop", async () => {
  const model = fakeModel({ subtype: "success", result: '"Black screen under popups."\nMore words' });
  assert.equal(await writerWith(model.query).write("shop", "fix ## 4. Black screen"), "Black screen under popups");
});

test("title writer: runs on the project's own account", async () => {
  const model = fakeModel({ subtype: "success", result: "Title" });
  await writerWith(model.query).write("shop", "task");
  assert.equal(model.calls[0].options?.env?.CLAUDE_CONFIG_DIR, "/home/me/.claude-work");
});

test("title writer: throws when the model fails", async () => {
  const model = fakeModel({ subtype: "error_max_turns" });
  await assert.rejects(writerWith(model.query).write("shop", "task"), /title failed/);
});

test("title writer: throws when the reply is empty", async () => {
  const model = fakeModel({ subtype: "success", result: "  " });
  await assert.rejects(writerWith(model.query).write("shop", "task"), /empty/);
});
