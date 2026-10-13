import { test } from "node:test";
import assert from "node:assert/strict";
import { chatRows, commandPreview, permissionAnswerOf, permissionRowSummary } from "./permission-lines.js";
import type { FeedEntryView } from "./protocol.js";

const LONG_COMMAND = `cd "/Users/me/database play" && python3 - <<'EOF'\nprint("checking the Caddyfile and every trusted proxy range")\nEOF`;

let nextId = 1;
function action(text: string): FeedEntryView {
  return { id: nextId++, at: "2026-10-12T17:00:00.000Z", kind: "action", about: "database play", text };
}
const allowed = (label: string) => action(`Allowed once: ${label}: Bash: ls -la`);
const denied = (label: string) => action(`Denied ${label}: Bash: rm -rf tmp`);
const answers = (...entries: FeedEntryView[]) => entries.flatMap((entry) => permissionAnswerOf(entry) ?? []);

test("permission lines: an allowed answer is read as outcome, label, tool and command", () => {
  assert.deepEqual(permissionAnswerOf(action(`Allowed once: database play: Bash: ${LONG_COMMAND}`)), {
    outcome: "Allowed once",
    allowed: true,
    label: "database play",
    tool: "Bash",
    command: LONG_COMMAND,
  });
});

test("permission lines: a denied answer is read too", () => {
  assert.equal(permissionAnswerOf(denied("dbadmin session 2"))?.label, "dbadmin session 2");
});

test("permission lines: other clicks are not permission answers", () => {
  assert.equal(permissionAnswerOf(action("Task sent: run the tests")), undefined);
});

test("permission lines: a long command is cut to one short line without its leading cd", () => {
  assert.equal(commandPreview(LONG_COMMAND), `python3 - <<'EOF' print("checking the Caddyfile and every tr…`);
});

test("permission lines: a short command is shown whole", () => {
  assert.equal(commandPreview("ls -la"), "ls -la");
});

test("permission lines: answers in a row about the same session fold into one row", () => {
  const rows = chatRows([allowed("database play"), allowed("database play"), allowed("dbadmin")]);
  assert.deepEqual(
    rows.map((row) => row.length),
    [2, 1],
  );
});

test("permission lines: a message between answers breaks their row", () => {
  const message: FeedEntryView = { ...action("hello"), kind: "orchestrator" };
  const rows = chatRows([allowed("database play"), message, allowed("database play")]);
  assert.equal(rows.length, 3);
});

test("permission lines: a row of allowed answers says how many were allowed where", () => {
  assert.equal(
    permissionRowSummary(answers(allowed("database play"), allowed("database play"))),
    "2 permissions allowed in database play",
  );
});

test("permission lines: a mixed row counts allowed and denied", () => {
  assert.equal(
    permissionRowSummary(answers(allowed("dbadmin"), allowed("dbadmin"), denied("dbadmin"))),
    "3 permissions in dbadmin: 2 allowed, 1 denied",
  );
});
