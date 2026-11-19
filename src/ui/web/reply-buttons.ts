// A drafted reply's Send (also ⌘↵ in its box) and Dismiss, and keeping "confirm send" on the text as you change it.

import type { DetailParts } from "./reply-detail-parts.js";
import type { ReplyRequests } from "./reply-requests.js";

export function wireReplyButtons({ input, dismiss, form }: DetailParts, requests: ReplyRequests): void {
  dismiss.addEventListener("click", () => void requests.run("dismiss", {}));
  form.addEventListener("submit", (submit) => {
    submit.preventDefault();
    void requests.run("send", { text: input.value });
  });
  input.addEventListener("keydown", (key) => {
    if (key.key === "Enter" && (key.metaKey || key.ctrlKey)) form.requestSubmit();
  });
  input.addEventListener("input", () => requests.markWhenPaused(() => input.value));
}
