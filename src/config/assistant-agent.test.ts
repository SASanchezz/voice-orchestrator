import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssistantAgentError, loadAssistantAgent, REQUIRED_SECTIONS } from "./assistant-agent.js";
import { ASSISTANT_AGENT_PATH } from "./paths.js";

const FRONTMATTER = "---\nname: voice-assistant\ndescription: Routes and checks requests.\n---\n";
const ALL_SECTIONS = REQUIRED_SECTIONS.map((section) => `## ${section}\n\n- A rule.\n`).join("\n");

function agentFile(content: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "vo-agent-")), "voice-assistant.md");
  writeFileSync(file, content);
  return file;
}

test("assistant agent: the checked-in definition passes every check", () => {
  assert.equal(loadAssistantAgent(ASSISTANT_AGENT_PATH).name, "voice-assistant");
});

test("assistant agent: a complete definition gives its name, description and rules", () => {
  const agent = loadAssistantAgent(agentFile(FRONTMATTER + ALL_SECTIONS));
  assert.deepEqual([agent.name, agent.description], ["voice-assistant", "Routes and checks requests."]);
});

test("assistant agent: a missing file is refused", () => {
  assert.throws(() => loadAssistantAgent(join(tmpdir(), "no-such-agent.md")), /is missing/);
});

test("assistant agent: a file without frontmatter is refused", () => {
  assert.throws(() => loadAssistantAgent(agentFile(ALL_SECTIONS)), /must start with a --- frontmatter block/);
});

test("assistant agent: a name that isn't lowercase with dashes is refused", () => {
  const content = FRONTMATTER.replace("voice-assistant", "Voice Assistant") + ALL_SECTIONS;
  assert.throws(() => loadAssistantAgent(agentFile(content)), /bad frontmatter: name/);
});

test("assistant agent: a missing description is refused", () => {
  const content = "---\nname: voice-assistant\n---\n" + ALL_SECTIONS;
  assert.throws(() => loadAssistantAgent(agentFile(content)), /bad frontmatter: description/);
});

test("assistant agent: frontmatter that isn't YAML is refused", () => {
  const content = "---\nname: [voice\n---\n" + ALL_SECTIONS;
  assert.throws(() => loadAssistantAgent(agentFile(content)), AssistantAgentError);
});

test("assistant agent: every missing section is named", () => {
  const content = FRONTMATTER + "## Task type\n\n- A rule.\n";
  assert.throws(
    () => loadAssistantAgent(agentFile(content)),
    /lacks the sections: Project and session routing, Requirement clarity, New session or continuation\./,
  );
});

test("assistant agent: a section with nothing under it counts as missing", () => {
  const content = FRONTMATTER + ALL_SECTIONS.replace("## Task type\n\n- A rule.\n", "## Task type\n");
  assert.throws(() => loadAssistantAgent(agentFile(content)), /lacks the sections: Task type\./);
});
