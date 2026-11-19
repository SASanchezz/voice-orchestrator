// 🎙 on a drafted reply: your words fill its box. Finishing, by click, Enter, the talk key or "finish", leaves them
// there to check; it never sends, because only Send or "confirm send" does.

import type { ReplyDraftView } from "../reply-views.js";
import { BoxNews } from "./box-news.js";
import { DictationBox } from "./dictation-box.js";
import type { DetailParts } from "./reply-detail-parts.js";

/** Wired before the box is locked for editing, since an idle dictation box makes its box editable. */
export function replyDictation(parts: DetailParts, view: ReplyDraftView, keepWords: () => void): BoxNews {
  const dictation = new DictationBox({ ...parts, sendFinished: keepWords });
  dictation.wire(parts.form);
  return new BoxNews(dictation, { describe: () => `→ reply to ${view.from}`, send: keepWords });
}
