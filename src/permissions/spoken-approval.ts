import { normalizeSpeech } from "../safety/confirm-phrase.js";
import type { Decision } from "./permission-types.js";

/** A whole message that answers a waiting request: "confirm", "confirm always", "deny", "allow commit", "confirm push". */
export interface SpokenApproval {
  decision: Decision;
  /** What it names, e.g. "commit" or "edits"; unset for a plain "allow". */
  verb?: string;
}

const ALLOW_WORDS = new Set(["allow", "confirm", "yes", "approve"]);
const DENY_WORDS = new Set(["deny", "no", "reject"]);
const ONCE = "once";
const ALWAYS = "always";
/**
 * Courtesy and pause words that change nothing: "okay, allow it please". "Hello" is how speech recognition often hears
 * "allow", so "hello, hello, confirm" still answers.
 */
const IGNORED_WORDS = new Set(["ok", "okay", "please", "it", "that", "this", "and", "um", "uh", "hello"]);

export function isSpokenApproval(words: string): boolean {
  return readApproval(meaningfulWords(words)) !== undefined;
}

/** Throws when `words` are not an approval; ask isSpokenApproval first. */
export function readSpokenApproval(words: string): SpokenApproval {
  const approval = readApproval(meaningfulWords(words));
  if (!approval) throw new Error(`Not an approval: "${words}"`);
  return approval;
}

function meaningfulWords(words: string): string[] {
  return normalizeSpeech(words)
    .split(" ")
    .filter((word) => word && !IGNORED_WORDS.has(word));
}

function readApproval([first, ...rest]: string[]): SpokenApproval | undefined {
  if (first === ALWAYS && rest.length === 1 && ALLOW_WORDS.has(rest[0])) return { decision: "always" };
  if (DENY_WORDS.has(first)) return deny(rest);
  return ALLOW_WORDS.has(first) ? allow(rest) : undefined;
}

function deny(rest: string[]): SpokenApproval | undefined {
  if (rest.length === 0) return { decision: "deny" };
  return rest.length === 1 && isVerb(rest[0]) ? { decision: "deny", verb: rest[0] } : undefined;
}

/** After "allow": nothing, "once", "always", or a verb with an optional "once" or "always" after it. */
function allow(rest: string[]): SpokenApproval | undefined {
  if (rest.length > 2) return undefined;
  const [word, after] = rest;
  if (word === undefined || word === ONCE || word === ALWAYS) return after === undefined ? plainAllow(word) : undefined;
  return isVerb(word) ? allowVerb(word, after) : undefined;
}

function plainAllow(word: string | undefined): SpokenApproval {
  return { decision: word === ALWAYS ? "always" : "once" };
}

function allowVerb(verb: string, after: string | undefined): SpokenApproval | undefined {
  if (after === undefined || after === ONCE) return { decision: "once", verb };
  return after === ALWAYS ? { decision: "always", verb } : undefined;
}

function isVerb(word: string): boolean {
  return word !== ONCE && word !== ALWAYS && !ALLOW_WORDS.has(word) && !DENY_WORDS.has(word);
}
