// Making a to-do item from chat messages: the server drafts it (downloading their files for the worker), and the
// dialog opens filled in so you can edit it and pick a project before it is saved. Nothing goes to a worker until
// you choose Run on… later.

import { fetchTaskDraft, type ChatAddress } from "./chat-browse-api.js";
import { openTodoDialogWith } from "./todo-dialog.js";

export async function openTaskFrom(chat: ChatAddress, messageIds: string[]): Promise<void> {
  try {
    openTodoDialogWith(await fetchTaskDraft(chat, messageIds));
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
}
