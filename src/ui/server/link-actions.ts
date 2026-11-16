import { linkOpenBody } from "./request-body.js";
import type { UiLookup } from "./ui-lookup.js";

/** Chrome, opening a link in one of its profiles. */
export interface ProfileBrowser {
  hasProfile(chromeProfile: string): boolean;
  open(url: string, chromeProfile: string): void;
  /** Chrome's first profile, for a link whose profile Chrome lacks. */
  openInDefault(url: string): void;
  /** The name Chrome shows for that first profile. */
  defaultProfileName(): string;
}

/** A link clicked in a project's chat or notice, opened in that project's Chrome profile. */
export class LinkActions {
  constructor(
    private lookup: Pick<UiLookup, "chromeProfileOf">,
    private browser: ProfileBrowser,
  ) {}

  open(body: unknown): string {
    const { url, project } = linkOpenBody.parse(body);
    const chromeProfile = this.lookup.chromeProfileOf(project);
    if (!this.browser.hasProfile(chromeProfile)) return this.openInDefault(url, chromeProfile);
    this.browser.open(url, chromeProfile);
    return `Opened in Chrome profile ${chromeProfile}.`;
  }

  private openInDefault(url: string, missingProfile: string): string {
    this.browser.openInDefault(url);
    const fallback = this.browser.defaultProfileName();
    const notice = `Chrome has no profile named "${missingProfile}", so the link opened in ${fallback}. Check the project's chromeProfile.`;
    console.warn(`[links] ${notice}`);
    return notice;
  }
}
