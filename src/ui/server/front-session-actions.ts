import type { FrontSession } from "../front-session.js";
import { frontSessionBody } from "./request-body.js";

/** Where a page says whether it is the one you are using, and which project tab's session it has open. */
export class FrontSessionActions {
  constructor(private front: FrontSession) {}

  note(body: unknown): string {
    const { page, session } = frontSessionBody.parse(body);
    if (session) this.front.pageInFront(page, session);
    else this.front.pageLeftFront(page);
    return "Noted.";
  }
}
