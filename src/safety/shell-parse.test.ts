import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShell } from "./shell-parse.js";
import { ShellSyntaxError } from "./shell-words.js";

const programs = (command: string): string[] => parseShell(command).map((s) => s.words[0]?.text ?? "");

test("shell: &&, ||, ;, pipes and line breaks split a command into its parts", () => {
  assert.deepEqual(programs("git status && git diff | head; ls\npwd || true"), [
    "git", "git", "head", "ls", "pwd", "true",
  ]); // prettier-ignore
});

test("shell: separators inside quotes are text", () => {
  assert.deepEqual(
    parseShell("grep 'a && b; c' file")[0].words.map((w) => w.text),
    ["grep", "a && b; c", "file"],
  );
});

test("shell: a quoted word is marked as quoted", () => {
  assert.equal(parseShell('echo "deploy now"')[0].words[1].quoted, true);
});

test("shell: a backslash escapes the next character", () => {
  assert.equal(parseShell("echo a\\ b")[0].words[1].text, "a b");
});

test("shell: a redirect to a file is a write", () => {
  assert.deepEqual(parseShell("echo hi > notes.txt")[0].writes, ["notes.txt"]);
});

test("shell: redirects to /dev/null and between streams write nothing", () => {
  assert.deepEqual(parseShell("ls 2>&1 >/dev/null")[0].writes, []);
});

test("shell: a heredoc's body is fed to its command, not run", () => {
  const [segment, ...rest] = parseShell("python3 - <<'EOF'\nimport os; print(1)\nEOF\nls");
  assert.deepEqual([segment.stdin, rest.length], [["import os; print(1)"], 1]);
});

test("shell: commands in $(…) are listed", () => {
  assert.deepEqual(parseShell('git diff "$(git merge-base main HEAD)"')[0].substitutions, ["git merge-base main HEAD"]);
});

test("shell: a comment is not a command", () => {
  assert.deepEqual(programs("ls # rm -rf /"), ["ls"]);
});

test("shell: an unclosed quote is refused, as a cut-off command would be", () => {
  assert.throws(() => parseShell("grep 'deploy"), ShellSyntaxError);
});

test("shell: a heredoc that never ends is refused", () => {
  assert.throws(() => parseShell("cat <<EOF\nline"), ShellSyntaxError);
});
