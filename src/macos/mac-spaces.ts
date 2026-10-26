import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { errorMessage } from "../shared/errors.js";

const run = promisify(execFile);

/** macOS key codes of the arrow keys. */
const LEFT_ARROW = 123;
const RIGHT_ARROW = 124;

export type ScriptRunner = (script: string) => Promise<void>;

/**
 * macOS Spaces (desktops and full-screen apps), switched like a three-finger swipe on the trackpad. Presses the
 * "Move left/right a space" shortcut (Ctrl+arrow, System Settings > Keyboard > Keyboard Shortcuts > Mission Control),
 * which needs Accessibility permission for the app running this one (System Settings > Privacy & Security).
 */
export class MacSpaces {
  constructor(private runScript: ScriptRunner = osascript) {}

  moveLeft(): Promise<void> {
    return this.pressControl(LEFT_ARROW);
  }

  moveRight(): Promise<void> {
    return this.pressControl(RIGHT_ARROW);
  }

  private async pressControl(keyCode: number): Promise<void> {
    try {
      await this.runScript(`tell application "System Events" to key code ${keyCode} using control down`);
    } catch (e) {
      console.error(`[spaces] couldn't switch: ${errorMessage(e)} (allow Accessibility for your terminal app)`);
    }
  }
}

async function osascript(script: string): Promise<void> {
  await run("osascript", ["-e", script]);
}
