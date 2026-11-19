import type { BrowsedFileView, BrowsedMessageView } from "../../ui/chat-browse-views.js";
import type { SlackFile, SlackMessage } from "../slack/slack-api.js";
import { dateOfTs, senderName } from "../slack/slack-history.js";
import type { SlackWorkspace } from "../slack/slack-workspace.js";
import { visibleText } from "./browsed-text.js";

const UNKNOWN_TYPE = "application/octet-stream";

/** A Slack message as All chats shows it: known by its ts, mentions named, its files listed. */
export async function slackMessageView(message: SlackMessage, workspace: SlackWorkspace): Promise<BrowsedMessageView> {
  const files = message.files ?? [];
  return {
    id: message.ts,
    from: await senderName(message, workspace),
    sentAt: dateOfTs(message.ts).toISOString(),
    text: visibleText(await workspace.names.plainText(message.text ?? "")),
    hasMedia: files.length > 0,
    files: files.flatMap(fileView),
  };
}

/** A file Slack gives no ID for (a deleted one, say) can't be downloaded, so it isn't offered. */
function fileView({ id, name, mimetype, size }: SlackFile): BrowsedFileView[] {
  if (!id) return [];
  return [{ id, name: name ?? id, mimeType: mimetype ?? UNKNOWN_TYPE, size: size ?? 0 }];
}
