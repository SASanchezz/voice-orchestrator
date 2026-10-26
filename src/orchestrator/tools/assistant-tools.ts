import { z } from "zod";
import type { CameraSource } from "../../camera/camera-source.js";
import type { Screenshot, ScreenSource } from "../../screen/screen-source.js";
import type { ResetRequests } from "../lifecycle/reset-requests.js";
import { NOTE_SECTIONS, type AssistantNotes } from "../memory/assistant-notes.js";
import { defineTool, text, type OperatorTool, type ToolResult } from "./tool-kit.js";

export function remember(notes: AssistantNotes): OperatorTool {
  return defineTool({
    name: "remember",
    description: "Add one line to the user's notes file, kept across resets and restarts.",
    args: {
      note: z.string().describe("One short line in plain words, e.g. 'dbadmin is also called database admin'"),
      section: z
        .enum(NOTE_SECTIONS)
        .describe(
          "Aliases: other names for projects or things; Project notes: facts about a project; Other: anything else",
        ),
    },
    run: ({ note, section }) => text(notes.remember(note, section)),
  });
}

export function resetContext(requests: ResetRequests): OperatorTool {
  return defineTool({
    name: "reset_context",
    description: "Restart your own conversation context once this reply is spoken.",
    args: {
      keep: z
        .enum(["notes", "nothing"])
        .describe("notes: carry a short handoff into the new session; nothing: start completely fresh"),
    },
    run: ({ keep }) => {
      requests.requestReset(keep);
      return text(
        `Context will reset after this reply${keep === "notes" ? ", keeping a short handoff" : ", starting fresh"}.`,
      );
    },
  });
}

export function restartOrchestrator(requests: ResetRequests): OperatorTool {
  return defineTool({
    name: "restart_orchestrator",
    description:
      "Restart the whole Voice Orchestrator app once this reply is spoken. Running worker tasks are stopped; projects, sessions, history and notes are kept.",
    args: {},
    run: () => {
      requests.requestRestart();
      return text("The app will restart after this reply.");
    },
  });
}

export function lookAtScreen(screen: ScreenSource): OperatorTool {
  return defineTool({
    name: "look_at_screen",
    description: "See the user's screen as it was when they started speaking (the display under their cursor).",
    args: {},
    run: async () => captioned("The user's screen when they started speaking:", await screen.latest()),
  });
}

export function lookAtCamera(camera: CameraSource): OperatorTool {
  return defineTool({
    name: "look_at_camera",
    description:
      "See the user's camera as it was when they started speaking: what they hold up or point at. Works only while Gestures are on.",
    args: {},
    run: async () => captioned("The user's camera when they started speaking:", await camera.latest()),
  });
}

function captioned(caption: string, image: Screenshot): ToolResult {
  return {
    content: [
      { type: "text", text: caption },
      { type: "image", ...image },
    ],
  };
}
