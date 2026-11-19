import type { ServerResponse } from "node:http";
import type { ClosedConversation, ClosedConversations } from "../../workers/closed-conversations.js";
import type { ClosedSessionView } from "../session-protocol.js";
import { sendJson } from "./changes-routes.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

const CLOSED_SESSIONS_PATH = /^\/api\/projects\/([^/]+)\/closed-sessions$/;

/** The closed sessions the session tabs' ↺ list offers to reopen. */
export class ClosedSessionRoutes {
  constructor(
    private access: UiAccess,
    private lookup: UiLookup,
    private closed: ClosedConversations,
  ) {}

  handles(url: URL): boolean {
    return CLOSED_SESSIONS_PATH.test(url.pathname);
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const project = decodeURIComponent(url.pathname.match(CLOSED_SESSIONS_PATH)?.[1] ?? "");
    this.lookup.requireProject(project);
    const conversations = await this.closed.list(project);
    sendJson(
      res,
      conversations.map((conversation) => ClosedSessionRoutes.toView(conversation)),
    );
  }

  private static toView({ claudeSessionId, title, lastActive }: ClosedConversation): ClosedSessionView {
    return { claudeSessionId, title, lastActive: lastActive.toISOString() };
  }
}
