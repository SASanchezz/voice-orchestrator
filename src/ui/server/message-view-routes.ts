import { replyRoutes } from "./reply-routes.js";
import type { Route, RouteHandlers } from "./route-table.js";

/** The Messages view's actions: drafted replies, the Drafting switch, and what you write in All chats. */
export function messageViewRoutes(h: Pick<RouteHandlers, "drafting" | "replies" | "chats">): [RegExp, Route][] {
  const sendInChat: Route = (b, m) => h.chats.send(decodeURIComponent(m[1]), decodeURIComponent(m[2]), b);
  return [
    [/^\/api\/replies\/drafting$/, (b) => h.drafting.change(b)],
    [/^\/api\/chats\/([^/]+)\/([^/]+)\/send$/, sendInChat],
    ...replyRoutes(h.replies),
  ];
}
