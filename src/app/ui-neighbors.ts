import type { FrontSession } from "../ui/front-session.js";
import type { ProfileBrowser } from "../ui/server/link-actions.js";
import type { NoticeParts } from "./build-notices.js";
import type { ReplyParts } from "./build-replies.js";
import type { OperatorNeighbors } from "./operator-types.js";

/**
 * What the web UI shows and acts on besides the operator's neighbors: the notice panel's notices, Chrome for links,
 * the project tab in front, which the page reports, and drafted replies.
 */
export type UiNeighbors = OperatorNeighbors & {
  notices: NoticeParts;
  links: ProfileBrowser;
  front: FrontSession;
  replies: ReplyParts;
};
