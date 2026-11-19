import type { EditorSettings } from "../config/editor-config.js";
import { OffEditor, type RestartableEditor } from "../editor/editor.js";
import { EditorProxy } from "../editor/editor-proxy.js";
import { EditorLauncher } from "../editor/editor-launcher.js";
import { EditorRestarter } from "../editor/editor-restarter.js";
import { editorCommand, EditorServer } from "../editor/editor-server.js";
import { desktopColorTheme } from "../editor/editor-theme.js";
import { KeptEditorFile } from "../editor/kept-editor-file.js";
import { NoEditorRoute, type EditorRoute } from "../ui/server/editor-route.js";
import { uiTokenFile } from "../ui/server/ui-access.js";

export interface EditorParts {
  /** VS Code's web server; main.ts starts it, and stops it or keeps it running over a restart; the page restarts it. */
  server: RestartableEditor;
  /** How the web UI passes the editor's requests on to it. */
  route: EditorRoute;
}

/** VS Code for the Code view when `editor.enabled`; its connection token is the web UI's, so there is one secret. */
export function buildEditor(settings: EditorSettings): EditorParts {
  if (!settings.enabled) return { server: new OffEditor(), route: new NoEditorRoute() };
  const launcher = new EditorLauncher(new KeptEditorFile());
  const command = editorCommand(settings, uiTokenFile());
  const server = new EditorRestarter(new EditorServer(command, launcher), command.port);
  return { server, route: new EditorProxy(settings.port, desktopColorTheme()) };
}
