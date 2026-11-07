/** What a hidden secret is replaced with. */
const HIDDEN = "[hidden]";

/** Not inside a word: like \b, but for any script (Cyrillic too). */
const START = String.raw`(?<![\p{L}\p{N}_])`;
const END = String.raw`(?![\p{L}\p{N}_])`;

const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

/** Tokens with a recognizable shape: Slack, GitHub, OpenAI/Anthropic, AWS, Google, JWTs and Authorization values. */
const TOKENS = [
  /\bxox[a-z]-[A-Za-z0-9-]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
];

/** A long run of letters and digits mixed, like an API key of unknown shape. */
const RANDOM_LOOKING = /\b(?=[\w+/=-]*\d)(?=[\w+/=-]*[A-Za-z])[\w+/=-]{32,}/g;

/** "password: hunter2", "my password is hunter2", "pwd=…", "пароль: …": the word stays, the value goes. */
const PASSWORD = new RegExp(
  `${START}((?:password|passwd|pwd|passcode|pass|пароль)${END}\\s*(?:is|:|=|-)\\s*)\\S+`,
  "giu",
);

/** 13 to 19 digits, optionally grouped with spaces or dashes. */
const CARD_NUMBER = /\b\d(?:[ -]?\d){12,18}\b/g;

/** Words that make a short number in the same message look like a one-time code. */
const CODE_WORDS = new RegExp(
  `${START}(?:code|otp|pin|passcode|verification|verify|2fa|one[- ]time|login|log in|sign[- ]in|код|пароль)${END}`,
  "iu",
);
const SHORT_NUMBER = /\b\d{3}[- ]\d{3}\b|\b\d{4,8}\b/g;

/** Hides anything that looks like a one-time code, password, token, card number or private key. */
export function hideSecrets(text: string): string {
  const shaped = TOKENS.reduce(hideMatches, text.replace(PRIVATE_KEY, HIDDEN));
  const unshaped = shaped.replace(RANDOM_LOOKING, HIDDEN).replace(PASSWORD, `$1${HIDDEN}`);
  return hideOneTimeCodes(unshaped.replace(CARD_NUMBER, HIDDEN));
}

function hideMatches(text: string, pattern: RegExp): string {
  return text.replace(pattern, HIDDEN);
}

function hideOneTimeCodes(text: string): string {
  return CODE_WORDS.test(text) ? text.replace(SHORT_NUMBER, HIDDEN) : text;
}
