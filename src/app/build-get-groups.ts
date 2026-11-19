import { ClosedSessionRoutes } from "../ui/server/closed-session-routes.js";
import type { GetRouteGroup } from "../ui/server/get-routes.js";
import type { UiAccess } from "../ui/server/ui-access.js";
import type { UiSources } from "./build-ui.js";
import { messageViewRoutes } from "./build-message-routes.js";
import { reviewRoutes } from "./build-review-routes.js";
import type { UiNeighbors } from "./ui-neighbors.js";

/** The GETs of the page's views: Review, Messages, and the closed sessions the session tabs' ↺ can reopen. */
export function getRouteGroups(access: UiAccess, neighbors: UiNeighbors, sources: UiSources): GetRouteGroup[] {
  return [
    reviewRoutes(access, sources.lookup, sources.changes),
    ...messageViewRoutes(access, neighbors.replies, sources.chatting),
    new ClosedSessionRoutes(access, sources.lookup, neighbors.workers.closedSessions),
  ];
}
