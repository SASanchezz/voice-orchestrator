import type { ReplyActions } from "./reply-actions.js";
import type { Route } from "./route-table.js";

export type { ReplyActions } from "./reply-actions.js";

/** A drafted Slack or Telegram reply's buttons; a draft is addressed by its ID. */
export function replyRoutes(replies: ReplyActions): [RegExp, Route][] {
  return [
    [/^\/api\/replies\/([\w-]+)\/edit$/, async (b, m) => replies.edit(m[1], b)],
    [/^\/api\/replies\/([\w-]+)\/send$/, async (b, m) => replies.send(m[1], b)],
    [/^\/api\/replies\/([\w-]+)\/dismiss$/, async (_b, m) => replies.dismiss(m[1])],
    [/^\/api\/replies\/([\w-]+)\/arm$/, (b, m) => replies.arm(m[1], b)],
  ];
}
