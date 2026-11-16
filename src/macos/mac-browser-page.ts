import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { errorMessage } from "../shared/errors.js";
import type { BrowserPage } from "../ui/server/page-opener.js";

const run = promisify(execFile);
const FOCUSED = "focused";

/** Brings Chrome's tab whose address starts with the given origin to the front; answers "focused" or "missing". */
const FOCUS_CHROME_TAB = `on run argv
  set origin to item 1 of argv
  if application "Google Chrome" is not running then return "missing"
  tell application "Google Chrome"
    repeat with chromeWindow in windows
      set tabIndex to 0
      repeat with chromeTab in tabs of chromeWindow
        set tabIndex to tabIndex + 1
        if URL of chromeTab starts with origin then
          set active tab index of chromeWindow to tabIndex
          set index of chromeWindow to 1
          activate
          return "${FOCUSED}"
        end if
      end repeat
    end repeat
  end tell
  return "missing"
end run`;

/**
 * macOS: the installed Chrome app showing the web UI, brought to the front; without one, the UI's open Chrome tab;
 * without that (or without permission to control Chrome), the link opens in your default browser.
 */
export class MacBrowserPage implements BrowserPage {
  /** chromeApp: the name of the Chrome app (Install page as app) the web UI runs in. */
  constructor(private chromeApp?: string) {}

  async focus(link: string): Promise<void> {
    if (this.chromeApp && (await this.showApp(this.chromeApp))) return;
    if (await this.focusOpenTab(new URL(link).origin)) return;
    spawn("open", [link], { stdio: "ignore" });
  }

  /** Its window comes up (started, if it wasn't running); the page there has already switched views, so no tab opens. */
  private async showApp(chromeApp: string): Promise<boolean> {
    try {
      await run("open", ["-a", chromeApp]);
      return true;
    } catch (e) {
      console.error(`[notices] couldn't bring up the ${chromeApp} app: ${errorMessage(e)}`);
      return false;
    }
  }

  private async focusOpenTab(origin: string): Promise<boolean> {
    try {
      const { stdout } = await run("osascript", ["-e", FOCUS_CHROME_TAB, origin]);
      return stdout.trim() === FOCUSED;
    } catch (e) {
      console.error(`[notices] couldn't look for the UI's Chrome tab: ${errorMessage(e)}`);
      return false;
    }
  }
}
