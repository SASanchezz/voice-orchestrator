import { withoutEnding } from "./transcript-ending.js";

/** Said at the end of what you say, these end the recording; the longer one first, so it is cut off whole. */
const STOP_PHRASES = ["finish recording", "finish"];
/** Sounds whisper writes down that ask for nothing on their own. */
const FILLER_WORDS = new Set(["um", "uh", "uhm", "hmm", "mm", "er", "ah", "oh"]);
const NOT_A_WORD = /[^\p{L}\p{N}\s]/gu;

/** True when your words so far end with a stop phrase: the recording should end now. */
export function endsWithStopPhrase(words: string): boolean {
  return STOP_PHRASES.some((phrase) => withoutEnding(words, phrase) !== words);
}

/** What you asked for: the transcript without a stop phrase at its end, or "" when nothing is left but filler. */
export function spokenRequest(transcript: string): string {
  const words = withoutStopPhrase(transcript);
  return asksForSomething(words) ? words : "";
}

function withoutStopPhrase(transcript: string): string {
  const phrase = STOP_PHRASES.find((stop) => withoutEnding(transcript, stop) !== transcript);
  return phrase ? withoutEnding(transcript, phrase) : transcript;
}

function asksForSomething(words: string): boolean {
  const spoken = words.replace(NOT_A_WORD, " ").toLowerCase().split(/\s+/).filter(Boolean);
  return spoken.some((word) => !FILLER_WORDS.has(word));
}
