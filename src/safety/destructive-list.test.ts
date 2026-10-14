import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESTRUCTIVE_PATH } from "../config/paths.js";
import { DestructiveList } from "./destructive-list.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-"));
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const list = new DestructiveList(rulesFile);

const DANGEROUS: [string, string][] = [
  ["git push origin main", "push"],
  ["git commit -m 'x'", "commit"],
  ["git reset --hard HEAD~1", "reset"],
  ["rm -rf dist", "delete"],
  ["git checkout .", "discard"],
  ["psql -c 'DROP TABLE users'", "drop"],
  ["git -C ../repo push", "push"],
  ["git -c user.name=x -c user.email=y commit -m z", "commit"],
  ["git --no-pager -C 'my repo' reset --hard", "reset"],
  ["cd api && git push --force", "push"],
  ["npm run deploy", "deploy"],
  ["cd infra && ./scripts/deploy.sh", "deploy"],
  ["git status; git push", "push"],
  ["psql <<'SQL'\nDROP TABLE users;\nSQL", "drop"],
  ['sh -c "git push origin main"', "push"],
  ["echo $(git push)", "push"],
  [`git log --oneline ${"src/feature/".repeat(40)} && git push`, "push"],
];
const SAFE = [
  "git add -A",
  "git status",
  "git diff --stat",
  "npm test",
  "rm notes.txt",
  "git checkout -b feature",
  "git -C repo status",
  "git log --grep push",
  "ls -la deploy/",
  "cat deploy/config.yml && grep -rn deploy src | head",
  "git diff -- deploy/app.yaml",
  "grep -rn 'git push' docs",
  "find . -path './deploy/*' -name '*.sql'",
  "sed -n '1,40p' scripts/deploy.sh",
  'echo "delete me" > notes.txt',
  "mkdir -p deploy/staging",
];

test("shipped rules flag dangerous commands with their confirm verb", () => {
  for (const [command, verb] of DANGEROUS) assert.equal(list.matchText(command)?.verb, verb, command);
});

test("a destructive verb is found in the whole command, however long", () => {
  assert.equal(list.matchText(`ls ${"x".repeat(500)} && git push`)?.verb, "push");
});

test("a cut-off command with an open quote is judged on its whole text", () => {
  assert.equal(list.matchText("git push origin 'main")?.verb, "push");
});

test("shipped rules pass safe commands", () => {
  for (const command of SAFE) assert.equal(list.matchText(command), undefined, command);
});

test("an added rule is saved to the file", () => {
  list.add({ pattern: "\\bhelm\\s+uninstall\\b", verb: "uninstall" });
  assert.equal(new DestructiveList(rulesFile).matchText("helm uninstall api")?.verb, "uninstall");
  list.remove("\\bhelm\\s+uninstall\\b");
});

test("a removed rule no longer matches", () => {
  list.add({ pattern: "\\bhelm\\s+uninstall\\b", verb: "uninstall" });
  list.remove("\\bhelm\\s+uninstall\\b");
  assert.equal(list.matchText("helm uninstall api"), undefined);
});

test("removing a rule that isn't there reports it", () => {
  assert.equal(list.remove("\\bnot-a-rule\\b"), false);
});

test("a bad regex in the file keeps the previous rules", () => {
  const file = join(tmp, "bad.yaml");
  writeFileSync(file, "rules:\n  - { pattern: 'git push', verb: push }\n");
  const rules = new DestructiveList(file);
  writeFileSync(file, "rules:\n  - { pattern: '([', verb: x }\n");
  rules.reload();
  assert.equal(rules.matchText("git push")?.verb, "push");
});
