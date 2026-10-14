import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyCall, readsSecrets } from "./call-safety.js";

const bash = (command: string): [string, Record<string, unknown>] => ["Bash", { command }];

const READS_SECRETS = [
  "cat .env",
  "cat .env.local",
  "grep API_KEY .env.production",
  "head ~/.ssh/id_rsa",
  "cat ~/.aws/credentials",
  "cat certs/server.pem",
  "cat config/secrets.yml",
  "cat auth_token.txt",
  "cat ~/.npmrc",
  "git show HEAD:.env",
  "python3 -c \"print(open('.env').read())\"",
  "security find-generic-password -s github -w",
  "printenv",
  "ls && cat .env | grep DB",
  "cp .env /tmp/backup",
];
const NO_SECRETS = [
  "cat .env.example",
  "cat .env.sample",
  "ls -la .env",
  "git check-ignore .env",
  "find . -name '.env*'",
  "grep -rn token src/",
  "grep -rn 'process.env' src",
  "cat src/auth/token-service.ts",
  "cat docs/secrets.md",
  "cat README.md",
];

test("reading a secret file or the keychain counts as reading secrets", () => {
  for (const command of READS_SECRETS) assert.equal(readsSecrets(...bash(command)), true, command);
});

test("examples, listings, searches and code about secrets read none", () => {
  for (const command of NO_SECRETS) assert.equal(readsSecrets(...bash(command)), false, command);
});

test("Claude Code's Read tool on a .env file reads secrets", () => {
  assert.equal(readsSecrets("Read", { file_path: "/repo/.env" }), true);
});

test("Claude Code's Read, Grep and Glob tools only read", () => {
  assert.deepEqual(
    ["Read", "Grep", "Glob"].map((tool) => isReadOnlyCall(tool, {})),
    [true, true, true],
  );
});

test("Claude Code's Edit tool is not read-only", () => {
  assert.equal(isReadOnlyCall("Edit", { file_path: "a.ts" }), false);
});
