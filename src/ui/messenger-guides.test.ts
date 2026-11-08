import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import YAML from "yaml";
import { z } from "zod";
import { messageProfiles, messagesSchema } from "../config/messages-config.js";
import { MESSENGER_GUIDES, type MessengerGuide } from "./messenger-guides.js";

const configFileSchema = z.object({ messages: messagesSchema });
const packageSchema = z.object({ scripts: z.record(z.string(), z.string()) });
const NPM_RUN = /^npm run ([\w-]+)/;

function sourcesConfiguredBy(guide: MessengerGuide): string[] {
  const { messages } = configFileSchema.parse(YAML.parse(guide.config));
  return messageProfiles(messages).map(([source]) => source);
}

function npmScriptsOf(guide: MessengerGuide): string[] {
  const commands = guide.steps.map((step) => step.command ?? "");
  return commands.map((command) => NPM_RUN.exec(command)?.[1] ?? "").filter(Boolean);
}

function appScripts(): string[] {
  const packageFile = packageSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
  return Object.keys(packageFile.scripts);
}

for (const guide of MESSENGER_GUIDES) {
  test(`messenger guides: ${guide.name}'s config example sets up exactly one source`, () => {
    assert.equal(sourcesConfiguredBy(guide).length, 1);
  });

  test(`messenger guides: ${guide.name}'s login command is one of the app's npm scripts`, () => {
    const [loginScript = "(none)"] = npmScriptsOf(guide);
    assert.ok(appScripts().includes(loginScript), `no npm script ${loginScript}`);
  });
}
