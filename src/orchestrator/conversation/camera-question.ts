import { POINTING_NOTE } from "../../sensors/pointing-cue.js";

/** A longer message likely asks for more than a look, which only the operator's model can handle. */
const MAX_WORDS = 15;

/**
 * Questions only the camera can answer. Kept narrow on purpose: a miss costs just the usual model turn,
 * while a false hit would answer "can you see the build log?" from the camera.
 */
const CAMERA_QUESTIONS = [
  /\b(can|could|do) you see me\b/,
  /\byou can see me\b/,
  /\bwhat (am i|i'm|i am) (holding|wearing|pointing at|showing you)\b/,
  /\bwhat('s| is) in my hands?\b/,
  /\bhow do i look\b/,
];

/** "What is this?" is about the camera only while you point at something. */
const POINTED_QUESTION = /\bwhat('s| is) (this|that)\b/;

/** Whether the message is nothing but a quick question about what the camera shows. */
export function isQuickCameraQuestion(message: string): boolean {
  const pointing = message.includes(POINTING_NOTE);
  const words = normalized(message.replace(POINTING_NOTE, ""));
  if (wordCount(words) > MAX_WORDS) return false;
  if (pointing && POINTED_QUESTION.test(words)) return true;
  return CAMERA_QUESTIONS.some((question) => question.test(words));
}

/** Whisper writes "I'm" with a straight or a curly apostrophe. */
function normalized(words: string): string {
  return words.toLowerCase().replaceAll("’", "'");
}

function wordCount(words: string): number {
  return words.split(/\s+/).filter(Boolean).length;
}
