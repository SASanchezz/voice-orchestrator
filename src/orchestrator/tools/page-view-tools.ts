import type { AppConfig } from "../../config/app-config.js";
import type { Editor } from "../../editor/editor.js";
import type { LiveClients } from "../../ui/server/live-clients.js";
import { defineTool, needProject, projectArg, text, type OperatorTool } from "./tool-kit.js";

const CODE_VIEW_OFF = "The Code view is off; set editor.enabled in config/config.yaml and restart to turn it on.";

/** The open web UI pages, told where to go. */
export type PageClients = Pick<LiveClients, "broadcast">;

/** VS Code on a project's folder, in the web UI. */
export function showCode(pages: PageClients, editor: Pick<Editor, "status">, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "show_code",
    description:
      "Show a project's code in the web UI: VS Code on its folder, with the worker's changes in Source Control, " +
      "e.g. 'show me webshop's code', 'open the editor for prewins'. Say only a short confirmation.",
    args: { project: projectArg },
    run: ({ project }) => {
      const name = needProject(cfg, project);
      if (editor.status === "off") throw new Error(CODE_VIEW_OFF);
      pages.broadcast("navigate", { view: "code", project: name });
      return text(`The web UI shows ${name}'s code.`);
    },
  });
}

/** Back from a project's code to its session chat. */
export function showChat(pages: PageClients, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "show_chat",
    description:
      "Show a project's session chat in the web UI, next to its code, e.g. 'back to chat', 'show webshop's chat'. " +
      "Say only a short confirmation.",
    args: { project: projectArg },
    run: ({ project }) => {
      const name = needProject(cfg, project);
      pages.broadcast("navigate", { view: "chat", project: name });
      return text(`The web UI shows ${name}'s chat.`);
    },
  });
}

/** A project's uncommitted changes in the Review view. */
export function showChanges(pages: PageClients, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "show_changes",
    description:
      "Open the web UI's Review view on a project's uncommitted changes, where every project's diffs are in one " +
      "place, e.g. 'show webshop's changes', 'let me review billing'. Say only a short confirmation.",
    args: { project: projectArg },
    run: ({ project }) => {
      const name = needProject(cfg, project);
      pages.broadcast("navigate", { view: "review", project: name });
      return text(`The web UI shows ${name}'s changes.`);
    },
  });
}
