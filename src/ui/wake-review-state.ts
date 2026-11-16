// The wake word review: your recordings, what may make each a poor take, and which are marked to delete. No DOM, so
// the server (Node, for tests) and the page (browser) both compile it.

import { isMuchQuieter, type ClipAnalysis, type ClipFlag } from "./wake-clip-analysis.js";
import type { WakeRecordingLabel, WakeRecordingView } from "./wake-recording-views.js";

export interface ReviewClip {
  recording: WakeRecordingView;
  analysis: ClipAnalysis;
}

/** Marks are kept across both kinds, until they are deleted together. */
export class WakeReview<Clip extends ReviewClip = ReviewClip> {
  private clips: Clip[] = [];
  private marks = new ReviewMarks();

  /** The recordings as they are now; marks on ones that are gone are dropped. */
  load(clips: Clip[]): void {
    this.clips = clips;
    this.marks.keepOnly(clips.map((clip) => clip.recording));
  }

  /** Oldest first. */
  ofLabel(label: WakeRecordingLabel): Clip[] {
    return this.clips.filter((clip) => clip.recording.label === label);
  }

  /** A wake word take is quiet next to your other wake word takes; quiet other talk is just your room. */
  flagsOf({ recording, analysis }: ReviewClip): ClipFlag[] {
    if (recording.label !== "wake") return analysis.flags;
    const peaks = this.ofLabel("wake").map((clip) => clip.analysis.peak);
    return isMuchQuieter(analysis.peak, peaks) ? ["quiet", ...analysis.flags] : analysis.flags;
  }

  isMarked(clip: ReviewClip): boolean {
    return this.marks.has(clip.recording);
  }

  toggleMark(clip: ReviewClip): void {
    this.marks.toggle(clip.recording);
  }

  /** The recordings with a flag, to listen to first. */
  suggestedOf(label: WakeRecordingLabel): Clip[] {
    return this.ofLabel(label).filter((clip) => this.flagsOf(clip).length > 0);
  }

  markSuggestedOf(label: WakeRecordingLabel): void {
    for (const clip of this.suggestedOf(label)) this.marks.add(clip.recording);
  }

  /** The "select all" checkbox: every recording of the kind. */
  markAllOf(label: WakeRecordingLabel): void {
    for (const clip of this.ofLabel(label)) this.marks.add(clip.recording);
  }

  unmarkAllOf(label: WakeRecordingLabel): void {
    for (const clip of this.ofLabel(label)) this.marks.remove(clip.recording);
  }

  markedCountOf(label: WakeRecordingLabel): number {
    return this.ofLabel(label).filter((clip) => this.isMarked(clip)).length;
  }

  markedRecordings(): WakeRecordingView[] {
    return this.clips.filter((clip) => this.isMarked(clip)).map((clip) => clip.recording);
  }
}

/** The recordings marked to delete. */
class ReviewMarks {
  private keys = new Set<string>();

  has(recording: WakeRecordingView): boolean {
    return this.keys.has(ReviewMarks.keyOf(recording));
  }

  add(recording: WakeRecordingView): void {
    this.keys.add(ReviewMarks.keyOf(recording));
  }

  toggle(recording: WakeRecordingView): void {
    if (!this.keys.delete(ReviewMarks.keyOf(recording))) this.add(recording);
  }

  remove(recording: WakeRecordingView): void {
    this.keys.delete(ReviewMarks.keyOf(recording));
  }

  keepOnly(recordings: WakeRecordingView[]): void {
    const present = new Set(recordings.map((recording) => ReviewMarks.keyOf(recording)));
    this.keys = new Set([...this.keys].filter((key) => present.has(key)));
  }

  private static keyOf({ label, name }: WakeRecordingView): string {
    return `${label}/${name}`;
  }
}
