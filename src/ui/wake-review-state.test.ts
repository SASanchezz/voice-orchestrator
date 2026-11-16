import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClipFlag } from "./wake-clip-analysis.js";
import type { WakeRecordingLabel } from "./wake-recording-views.js";
import { WakeReview, type ReviewClip } from "./wake-review-state.js";

const USUAL_PEAK = 0.1;
const FAR_AWAY_PEAK = 0.02;

function clip(label: WakeRecordingLabel, name: string, peak = USUAL_PEAK): ReviewClip {
  return { recording: { label, name, recordedAt: "" }, analysis: { bars: [], peak, flags: [] } };
}

function flagged(name: string, flag: ClipFlag): ReviewClip {
  const { recording, analysis } = clip("wake", name);
  return { recording, analysis: { ...analysis, flags: [flag] } };
}

function reviewOf(...clips: ReviewClip[]): WakeReview {
  const review = new WakeReview();
  review.load(clips);
  return review;
}

function names(clips: ReviewClip[]): string[] {
  return clips.map((shown) => shown.recording.name);
}

function markedNames(review: WakeReview): string[] {
  return review.markedRecordings().map((recording) => recording.name);
}

const WAKE_A = clip("wake", "a.wav");
const WAKE_B = clip("wake", "b.wav");
const WAKE_FAR = clip("wake", "far.wav", FAR_AWAY_PEAK);
const OTHER_A = clip("other", "a.wav");

test("wake review: each kind lists only its own recordings", () => {
  assert.deepEqual(names(reviewOf(WAKE_A, OTHER_A, WAKE_B).ofLabel("wake")), ["a.wav", "b.wav"]);
});

test("wake review: a wake word take far quieter than the others is flagged quiet", () => {
  assert.deepEqual(reviewOf(WAKE_A, WAKE_B, WAKE_FAR).flagsOf(WAKE_FAR), ["quiet"]);
});

test("wake review: quiet other talk isn't flagged: it is your room", () => {
  const quietRoom = clip("other", "room.wav", FAR_AWAY_PEAK);
  assert.deepEqual(reviewOf(OTHER_A, clip("other", "b.wav"), quietRoom).flagsOf(quietRoom), []);
});

test("wake review: marking twice unmarks", () => {
  const review = reviewOf(WAKE_A);
  review.toggleMark(WAKE_A);
  review.toggleMark(WAKE_A);
  assert.equal(review.isMarked(WAKE_A), false);
});

test("wake review: marks from both tabs are deleted together", () => {
  const review = reviewOf(WAKE_A, OTHER_A);
  review.toggleMark(WAKE_A);
  review.toggleMark(OTHER_A);
  assert.equal(review.markedRecordings().length, 2);
});

test("wake review: marking the suggested marks the flagged takes in the open tab", () => {
  const review = reviewOf(WAKE_A, WAKE_B, flagged("cut.wav", "cut off"), WAKE_FAR);
  review.markSuggestedOf("wake");
  assert.deepEqual(markedNames(review), ["cut.wav", "far.wav"]);
});

test("wake review: marks on recordings that are gone are dropped", () => {
  const review = reviewOf(WAKE_A, WAKE_B);
  review.toggleMark(WAKE_A);
  review.load([WAKE_B]);
  assert.deepEqual(review.markedRecordings(), []);
});

test("wake review: selecting all marks every recording of that kind", () => {
  const review = reviewOf(WAKE_A, WAKE_B, OTHER_A);
  review.markAllOf("wake");
  assert.deepEqual(markedNames(review), ["a.wav", "b.wav"]);
});

test("wake review: clearing all unmarks only that kind", () => {
  const review = reviewOf(WAKE_A, OTHER_A);
  review.markAllOf("wake");
  review.markAllOf("other");
  review.unmarkAllOf("wake");
  assert.deepEqual(review.markedRecordings(), [OTHER_A.recording]);
});

test("wake review: each kind counts its own marks", () => {
  const review = reviewOf(WAKE_A, WAKE_B, OTHER_A);
  review.toggleMark(WAKE_A);
  review.toggleMark(OTHER_A);
  assert.equal(review.markedCountOf("wake"), 1);
});
