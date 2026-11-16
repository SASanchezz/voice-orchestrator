// ⚙ › Wake word › Train… › Review recordings: listen through your recordings, mark the poor ones, and delete them
// together.

import { WakeReview } from "../wake-review-state.js";
import { post } from "./api.js";
import { ClipAudio, ClipLoader, type PlayableClip } from "./wake-clip-audio.js";
import { ReviewButtonsView } from "./wake-review-buttons.js";
import { reviewCommandOf } from "./wake-review-keys.js";
import { ReviewList } from "./wake-review-list.js";
import { ReviewPlayer } from "./wake-review-player.js";
import { ReviewRenderer } from "./wake-review-render.js";
import { buildReviewDialog, showReviewStatus, wireReviewButtons, type ReviewParts } from "./wake-review-view.js";

const DELETE_PATH = "/api/wake-training/delete";
const LOADING = "Loading your recordings…";
const DELETING = "Deleting…";

/** The review window, put together; playback stops when it closes. */
export function createWakeReview(): WakeReviewDialog {
  const parts = buildReviewDialog();
  const review = new WakeReview<PlayableClip>();
  const renderer = new ReviewRenderer(parts, review, new ReviewButtonsView(parts, review));
  const player = new ReviewPlayer(renderer, new ClipAudio());
  const list = new ReviewList(renderer, review, player);
  parts.dialog.addEventListener("close", () => player.stop());
  parts.dialog.addEventListener("keydown", (event) => runKey(event, list));
  return new WakeReviewDialog(parts, list, review);
}

function runKey(event: KeyboardEvent, list: ReviewList): void {
  const command = reviewCommandOf(event);
  if (!command) return;
  event.preventDefault(); // Space would also press the focused button, and the arrows scroll
  list.run(command);
}

export class WakeReviewDialog {
  private loader = new ClipLoader();

  constructor(
    private parts: ReviewParts,
    private list: ReviewList,
    private review: WakeReview<PlayableClip>,
  ) {
    wireReviewButtons(parts, {
      showKind: (kind) => list.showKind(kind),
      markSuggested: () => this.markSuggested(),
      toggleAll: () => this.toggleAll(),
      deleteMarked: () => void this.deleteMarked(),
    });
  }

  /** `onClosed` runs once it is closed again. */
  async open(onClosed: () => void): Promise<void> {
    this.parts.dialog.addEventListener("close", onClosed, { once: true });
    this.parts.dialog.showModal();
    this.parts.list.focus();
    showReviewStatus(this.parts, LOADING, "is-working");
    await this.reportingFailure(() => this.reloadSaying(""));
  }

  private markSuggested(): void {
    this.review.markSuggestedOf(this.list.shownKind());
    this.list.render();
  }

  private toggleAll(): void {
    const kind = this.list.shownKind();
    const isAllTicked = this.review.markedCountOf(kind) === this.review.ofLabel(kind).length;
    if (isAllTicked) this.review.unmarkAllOf(kind);
    else this.review.markAllOf(kind);
    this.list.render();
  }

  private async deleteMarked(): Promise<void> {
    const recordings = this.review.markedRecordings().map(({ label, name }) => ({ label, name }));
    showReviewStatus(this.parts, DELETING, "is-working");
    await this.reportingFailure(async () => this.reloadSaying((await post(DELETE_PATH, { recordings })) ?? ""));
  }

  private async reloadSaying(message: string): Promise<void> {
    this.review.load(await this.loader.loadAll());
    this.list.render();
    showReviewStatus(this.parts, message, "");
  }

  private async reportingFailure(step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (error) {
      showReviewStatus(this.parts, error instanceof Error ? error.message : String(error), "is-refused");
    }
  }
}
