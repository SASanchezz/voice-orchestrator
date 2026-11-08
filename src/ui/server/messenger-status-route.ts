import type { ServerResponse } from "node:http";
import type { MessengerStatus } from "../../messages/messenger-status.js";
import { sendJson } from "./changes-routes.js";
import type { UiAccess } from "./ui-access.js";

export const MESSENGER_STATUS_PATH = "/api/messengers";

/** What ⚙ › Messengers shows beside the button: which messengers catch-up reads. */
export class MessengerStatusRoute {
  constructor(
    private access: UiAccess,
    private status: MessengerStatus,
  ) {}

  async all(url: URL, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    sendJson(res, await this.status.all());
  }
}
