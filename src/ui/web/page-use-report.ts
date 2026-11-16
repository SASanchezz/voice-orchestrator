// Tells the server when you come to this page or click in it, so a recording started by the talk key, the wake word
// or a gesture puts your words into this page's message box, and not into a pop-up's or another page's.

import { report } from "./api.js";
import { isPageInUse, wireFocusChecks } from "./page-focus.js";
import { PAGE_ID } from "./page-id.js";

let wasInUse = false;

/** Said when the page opens or reconnects too: a restarted server knows of no page. */
export function reportPageUse(): void {
  report("/api/page-used", { page: PAGE_ID });
}

/** The notice panel's page, hidden with its panel: your words no longer go to its reply box. */
export function reportPageHidden(): void {
  report("/api/page-hidden", { page: PAGE_ID });
}

export function wirePageUseReport(): void {
  wireFocusChecks(reportIfCameBack);
  document.addEventListener("pointerdown", reportPageUse, { capture: true }); // a click back from a pop-up
}

function reportIfCameBack(): void {
  const isInUse = isPageInUse();
  if (isInUse && !wasInUse) reportPageUse();
  wasInUse = isInUse;
}
