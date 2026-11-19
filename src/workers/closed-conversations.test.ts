import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry, type RegistryParts } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import { ClosedConversations } from "./closed-conversations.js";
import { HEADLESS_NOTE } from "./task-launcher.js";

const PROJECT_FOLDER = "/work/web shop";
const TRANSCRIPTS_KEY = "-work-web-shop";

interface Setup {
  closed: ClosedConversations;
  parts: RegistryParts;
  transcripts: string;
}

function setUp(): Setup {
  const root = mkdtempSync(join(tmpdir(), "vo-closed-"));
  setStateDir(join(root, "state"));
  const transcripts = join(root, "claude", "projects", TRANSCRIPTS_KEY);
  mkdirSync(transcripts, { recursive: true });
  const cfg = testConfig({
    profiles: { personal: { configDir: join(root, "claude") } },
    projects: { webshop: { path: PROJECT_FOLDER, profile: "personal" } },
  });
  const parts = openRegistry({ webshop: "personal" }, new AppEvents());
  return { closed: new ClosedConversations(cfg, parts.projects, parts.sessions), parts, transcripts };
}

function writeTranscript(folder: string, id: string, prompt: string): string {
  const lines = [
    { type: "ai-title", aiTitle: `title of ${id}` },
    { type: "user", message: { role: "user", content: [{ type: "text", text: prompt }] } },
  ];
  const file = join(folder, `${id}.jsonl`);
  writeFileSync(file, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
  return file;
}

function writeWorkerTranscript(folder: string, id: string): string {
  return writeTranscript(folder, id, `fix the footer${HEADLESS_NOTE}`);
}

function backdate(file: string, seconds: number): void {
  const when = new Date(Date.now() - seconds * 1000);
  utimesSync(file, when, when);
}

async function listedIds(closed: ClosedConversations): Promise<string[]> {
  return (await closed.list("webshop")).map((conversation) => conversation.claudeSessionId);
}

test("a worker conversation no session continues is listed with Claude Code's title", async () => {
  const { closed, transcripts } = setUp();
  writeWorkerTranscript(transcripts, "old");
  assert.equal((await closed.list("webshop"))[0].title, "title of old");
});

test("conversations this app's workers didn't start are not listed", async () => {
  const { closed, transcripts } = setUp();
  writeTranscript(transcripts, "vscode", "fix the footer");
  assert.deepEqual(await listedIds(closed), []);
});

test("a conversation an open session continues is not listed", async () => {
  const { closed, parts, transcripts } = setUp();
  writeWorkerTranscript(transcripts, "open");
  parts.sessions.updateSession(parts.registry.activeSession("webshop").id, { claudeSessionId: "open" });
  assert.deepEqual(await listedIds(closed), []);
});

test("closed sessions are listed latest first", async () => {
  const { closed, transcripts } = setUp();
  backdate(writeWorkerTranscript(transcripts, "older"), 60);
  writeWorkerTranscript(transcripts, "newer");
  assert.deepEqual(await listedIds(closed), ["newer", "older"]);
});

test("a project Claude Code never ran in has no closed sessions", async () => {
  const { closed, transcripts } = setUp();
  rmSync(transcripts, { recursive: true });
  assert.deepEqual(await listedIds(closed), []);
});

test("a listed closed session is found by its Claude session id", async () => {
  const { closed, transcripts } = setUp();
  writeWorkerTranscript(transcripts, "old");
  assert.equal((await closed.find("webshop", "old")).title, "title of old");
});

test("finding a session that isn't closed is refused", async () => {
  const { closed } = setUp();
  await assert.rejects(closed.find("webshop", "missing"), /no closed session missing/);
});
