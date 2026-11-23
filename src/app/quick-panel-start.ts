import type { AppConfig } from "../config/app-config.js";
import { MacQuickPanel } from "../macos/mac-quick-panel.js";
import { errorMessage } from "../shared/errors.js";
import type { UiServer } from "../ui/server/ui-server.js";

/** The quick panel, waiting for its key combo once the web UI serves its page; the app runs on without it. */
export async function startQuickPanel({ quickPanelHotkey }: AppConfig["ui"], server: UiServer): Promise<void> {
  try {
    await launch(quickPanelHotkey, server);
  } catch (e) {
    console.error(`[quick panel] not started: ${errorMessage(e)}`);
  }
}

async function launch(hotkey: string, server: UiServer): Promise<void> {
  const panel = await MacQuickPanel.create();
  panel.start(server.quickLink(), hotkey);
}
