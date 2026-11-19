// One drafted reply: its row in the list, and its pane when selected. The box holds exactly what Send sends: what you
// see is what you approve. 🎙 speaks into it, and finishing a recording only leaves the words there to check, never
// sends. Selecting a reply marks what its box shows for "confirm send", so saying that sends this text and nothing else.

import type { ReplyDraftView } from "../reply-views.js";
import type { BoxNews } from "./box-news.js";
import { fetchReplyContext } from "./reply-api.js";
import { detailParts, renderDetailHeader, renderThread, type DetailParts } from "./reply-detail-parts.js";
import { wireReplyButtons } from "./reply-buttons.js";
import { replyDictation } from "./reply-dictation.js";
import { ReplyEditing } from "./reply-editing.js";
import { ReplyRequests } from "./reply-requests.js";
import { renderRow, replyRow } from "./reply-row.js";
import { claimVoiceBox, releaseVoiceBox } from "./voice-box-router.js";

export class ReplyCard {
  readonly row: HTMLButtonElement;
  private parts: DetailParts = detailParts();
  readonly detail = this.parts.detail;
  private news: BoxNews;
  private requests: ReplyRequests;
  private editing: ReplyEditing;

  constructor(view: ReplyDraftView, done: (message: string) => void) {
    this.row = replyRow(view);
    this.requests = new ReplyRequests(view.id, this.parts.status, done);
    this.news = replyDictation(this.parts, view, () => this.editing.unlock());
    this.editing = new ReplyEditing(this.parts.input, this.parts.edit, this.requests);
    wireReplyButtons(this.parts, this.requests);
    this.parts.mic.addEventListener("click", () => this.claimDictation(), { capture: true }); // before it records
    this.update(view);
    void fetchReplyContext(view.id).then((lines) => renderThread(this.parts.thread, lines));
  }

  /** A newer copy of the draft; the text is left alone while you are working on it. */
  update(view: ReplyDraftView): void {
    renderRow(this.row, view);
    renderDetailHeader(this.parts.header, view);
    this.editing.show(view.text);
  }

  /** Shown in the pane, and marked for "confirm send": you are looking at exactly this text. */
  select(): void {
    this.setSelected(true);
    this.row.scrollIntoView({ block: "nearest" });
    this.requests.markForVoice(this.parts.input.value);
  }

  deselect(): void {
    this.setSelected(false);
  }

  edit(): void {
    this.editing.unlock();
  }

  remove(): void {
    releaseVoiceBox(this.news);
    this.row.remove();
    this.parts.detail.remove();
  }

  private setSelected(isSelected: boolean): void {
    this.row.classList.toggle("selected", isSelected);
    this.row.setAttribute("aria-selected", String(isSelected));
    this.parts.detail.hidden = !isSelected;
  }

  private claimDictation(): void {
    this.editing.unlock();
    claimVoiceBox(this.news);
  }
}
