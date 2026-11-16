// The wake word review's Select all checkbox, Select flagged and Delete buttons, as the ticks are now.

import type { WakeRecordingLabel } from "../wake-recording-views.js";
import type { WakeReview } from "../wake-review-state.js";
import type { ReviewParts } from "./wake-review-view.js";

export class ReviewButtonsView {
  constructor(
    private parts: ReviewParts,
    private review: WakeReview,
  ) {}

  /** For the tab of `kind`; Delete counts the ticks on both tabs. */
  show(kind: WakeRecordingLabel): void {
    this.showSelectAll(kind);
    const suggested = this.review.suggestedOf(kind).length;
    this.parts.suggest.textContent = `Select flagged (${suggested})`;
    this.parts.suggest.disabled = suggested === 0;
    const marked = this.review.markedRecordings().length;
    this.parts.remove.textContent = marked === 0 ? "Delete selected" : `Delete ${marked} selected`;
    this.parts.remove.disabled = marked === 0;
  }

  /** Ticked when all on the tab are, half-ticked when some are. */
  private showSelectAll(kind: WakeRecordingLabel): void {
    const total = this.review.ofLabel(kind).length;
    const ticked = this.review.markedCountOf(kind);
    this.parts.selectAll.checked = total > 0 && ticked === total;
    this.parts.selectAll.indeterminate = ticked > 0 && ticked < total;
    this.parts.selectAll.disabled = total === 0;
  }
}
