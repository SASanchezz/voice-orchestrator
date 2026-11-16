import { execFile } from "node:child_process";
import { errorMessage } from "../shared/errors.js";
import type { ProfileBrowser } from "../ui/server/link-actions.js";
import {
  CHROME_LOCAL_STATE,
  DEFAULT_CHROME_FOLDER,
  chromeProfileFolder,
  hasChromeProfile,
  profileNameOf,
} from "./chrome-profile-folders.js";

const CHROME_APP = "Google Chrome";

/** macOS: hands the link to the running Chrome (or starts it), which opens it in a window of that profile. */
export class MacChromeLinks implements ProfileBrowser {
  hasProfile(chromeProfile: string): boolean {
    return hasChromeProfile(CHROME_LOCAL_STATE, chromeProfile);
  }

  open(url: string, chromeProfile: string): void {
    launchChrome(url, chromeProfileFolder(CHROME_LOCAL_STATE, chromeProfile), chromeProfile);
  }

  openInDefault(url: string): void {
    launchChrome(url, DEFAULT_CHROME_FOLDER, "default");
  }

  defaultProfileName(): string {
    return profileNameOf(CHROME_LOCAL_STATE, DEFAULT_CHROME_FOLDER);
  }
}

function launchChrome(url: string, folder: string, shownName: string): void {
  const args = ["-na", CHROME_APP, "--args", `--profile-directory=${folder}`, url];
  execFile("open", args, (error) => {
    if (!error) return;
    console.error(`[links] couldn't open a link in Chrome profile ${shownName}: ${errorMessage(error)}`);
  });
}
