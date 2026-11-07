import { z } from "zod";
import type { ConfirmAsk } from "../conversation/confirm-ask.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

const verbArg = z
  .string()
  .regex(/^[a-z]+$/i, "One word, letters only")
  .describe("The word after 'confirm', e.g. push");

/** Shows Confirm and Cancel buttons under your reply; it approves nothing by itself. */
export function askToConfirm(confirmAsk: ConfirmAsk): OperatorTool {
  return defineTool({
    name: "ask_to_confirm",
    description:
      "Call this whenever you ask the user to say a confirm phrase, in the same turn. The web UI then shows " +
      "'Confirm <verb>' and 'Cancel' buttons under your reply until the user's next words. It approves nothing; " +
      "only the user's own words do. Don't call it when you only mention or explain a phrase.",
    args: { verbs: z.array(verbArg).min(1).describe("Each verb you ask for, e.g. ['update', 'delete']") },
    run: ({ verbs }) => {
      confirmAsk.ask(verbs);
      return text("Confirm buttons shown.");
    },
  });
}
