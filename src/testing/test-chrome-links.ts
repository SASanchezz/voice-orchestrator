import type { ProfileBrowser } from "../ui/server/link-actions.js";

/** The profile name recorded for a link opened in Chrome's first profile. */
export const DEFAULT_PROFILE = "(default)";

/** A link opened in a Chrome profile, as a fake Chrome records it. */
export interface OpenedLink {
  url: string;
  chromeProfile: string;
}

/** A fake Chrome that records the links it was asked to open; it has every profile but those listed as missing. */
export class TestChromeLinks implements ProfileBrowser {
  opened: OpenedLink[] = [];
  missingProfiles: string[] = [];

  hasProfile(chromeProfile: string): boolean {
    return !this.missingProfiles.includes(chromeProfile);
  }

  open(url: string, chromeProfile: string): void {
    this.opened.push({ url, chromeProfile });
  }

  openInDefault(url: string): void {
    this.opened.push({ url, chromeProfile: DEFAULT_PROFILE });
  }

  defaultProfileName(): string {
    return DEFAULT_PROFILE;
  }
}
