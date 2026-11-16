import { normalizeSpeech } from "../safety/confirm-phrase.js";
import { isFileEdit } from "./edit-scope.js";
import type { Pending } from "./permission-types.js";
import type { SpokenApproval } from "./spoken-approval.js";

/** What you call a file edit when you allow it: "allow edits", "allow changes". */
const EDIT_VERBS = new Set(["edit", "edits", "change", "changes", "write", "writes"]);

/** The waiting requests a spoken approval can be about: all of them, or those it names by its verb. */
export function requestsMatching(approval: SpokenApproval, waiting: Pending[]): Pending[] {
  const { verb } = approval;
  if (verb === undefined) return waiting;
  return waiting.filter((pending) => namesRequest(verb, pending));
}

/** The requests a spoken approval may answer, in the order they came: those of the session in front, or else all. */
export function requestsInScope(matching: Pending[], sessionInFront: string | undefined): Pending[] {
  const inFront = matching.filter((pending) => pending.session === sessionInFront);
  return inFront.length > 0 ? inFront : matching;
}

/** "commit" names a commit request, "edits" a file edit, and "npm" a command that runs npm. */
function namesRequest(verb: string, pending: Pending): boolean {
  if (pending.destructive?.verb === verb) return true;
  if (EDIT_VERBS.has(verb) && isFileEdit(pending.toolName)) return true;
  return normalizeSpeech(pending.description).split(" ").includes(verb);
}
