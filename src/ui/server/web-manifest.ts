import type { ServerResponse } from "node:http";
import { HTTP_STATUS } from "./http-error.js";
import type { UiAccess } from "./ui-access.js";

export const MANIFEST_PATH = "/manifest.webmanifest";
const APP_NAME = "Orchestrator";
/** The page's own colours (--bg, --surface), so the window doesn't flash white or show a mismatched strip. */
const BACKGROUND_COLOUR = "#0d1117";
const THEME_COLOUR = "#161b22";

/**
 * Makes the page installable as a Chrome app whose title bar can fold into the page's top bar (window controls
 * overlay), so Chrome's back, reload and title strip don't take a row of their own.
 */
export class WebManifest {
  constructor(private access: Pick<UiAccess, "requireToken" | "link">) {}

  serve(url: URL, res: ServerResponse): void {
    const manifest = this.contents(url);
    res.writeHead(HTTP_STATUS.ok, { "content-type": "application/manifest+json", "cache-control": "no-store" });
    res.end(manifest);
  }

  /** The manifest as JSON, for a request that carries the token. */
  contents(url: URL): string {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    return JSON.stringify(this.manifest());
  }

  private manifest(): object {
    const link = new URL(this.access.link());
    return {
      name: APP_NAME,
      short_name: APP_NAME,
      start_url: `${link.pathname}${link.search}`,
      scope: "/",
      display: "standalone",
      display_override: ["window-controls-overlay"],
      background_color: BACKGROUND_COLOUR,
      theme_color: THEME_COLOUR,
    };
  }
}
