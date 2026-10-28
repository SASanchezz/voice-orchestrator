import type { EditorSettings } from "../config/editor-config.js";
import { OffEditor, type Editor } from "../editor/editor.js";
import { EditorProxy } from "../editor/editor-proxy.js";
import { editorCommand, EditorServer } from "../editor/editor-server.js";
import { NoEditorRoute, type EditorRoute } from "../ui/server/editor-route.js";
import { uiTokenFile } from "../ui/server/ui-access.js";

export interface EditorParts {
  /** VS Code's web server; main.ts starts and stops it. */
  server: Editor;
  /** How the web UI passes the editor's requests on to it. */
  route: EditorRoute;
}

/** VS Code for the Code view when `editor.enabled`; its connection token is the web UI's, so there is one secret. */
export function buildEditor(settings: EditorSettings): EditorParts {
  if (!settings.enabled) return { server: new OffEditor(), route: new NoEditorRoute() };
  const server = new EditorServer(editorCommand(settings, uiTokenFile()));
  return { server, route: new EditorProxy(settings.port) };
}
