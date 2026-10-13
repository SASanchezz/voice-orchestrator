// Clicked permission answers in the assistant's chat: one short line each, and runs of them folded into one line.

import type { FeedEntryView } from "../protocol.js";
import {
  commandPreview,
  permissionAnswerOf,
  permissionRowSummary,
  type PermissionAnswer,
} from "../permission-lines.js";
import { button, el, formatTime } from "./dom.js";
import { openSessionById } from "./session-link.js";

/** "Allowed once: database play, Bash  cd … && python3 - <<'EOF'…", the command expanding on click. */
export function permissionItem(entry: FeedEntryView, answer: PermissionAnswer): HTMLLIElement {
  return answerItem(entry, permissionLine(entry, answer));
}

/** "4 permissions allowed in database play", opening to each answer's line. */
export function permissionRowItem(entries: FeedEntryView[]): HTMLLIElement {
  const answered = entries.flatMap((entry) => {
    const answer = permissionAnswerOf(entry);
    return answer ? [{ entry, answer }] : [];
  });
  const last = entries[entries.length - 1];
  const summary = el("summary", {}, timeOf(last), permissionRowSummary(answered.map(({ answer }) => answer)));
  const lines = answered.map(({ entry, answer }) => permissionLine(entry, answer));
  return answerItem(last, el("details", { class: "permission-row" }, summary, ...lines));
}

function answerItem(entry: FeedEntryView, content: HTMLElement): HTMLLIElement {
  const item = el("li", { class: "entry action permission" }, content);
  item.dataset.entry = String(entry.id);
  return item;
}

function permissionLine(entry: FeedEntryView, answer: PermissionAnswer): HTMLDivElement {
  const { outcome, tool, command } = answer;
  return el(
    "div",
    { class: "permission-line" },
    timeOf(entry),
    `${outcome}: `,
    labelOf(entry, answer),
    `, ${tool}`,
    commandView(command),
  );
}

/** The asker's label, a link to its session when the entry knows it. */
function labelOf(entry: FeedEntryView, answer: PermissionAnswer): HTMLElement | string {
  const { session } = entry;
  if (!session) return answer.label;
  const link = button(answer.label, "permission-link", () => void openSessionById(session.id));
  link.title = "Show this session";
  return link;
}

/** A short look at the command; a long one shows whole on click. */
function commandView(command: string): HTMLElement {
  const preview = el("code", {}, commandPreview(command));
  if (commandPreview(command) === command.trim()) return preview;
  return el("details", { class: "permission-command" }, el("summary", {}, preview), el("pre", {}, command));
}

function timeOf(entry: FeedEntryView): HTMLSpanElement {
  return el("span", { class: "permission-time" }, formatTime(entry.at));
}
