// A short note at the bottom of the Messages view, such as "Sent to Bob.", that fades by itself.

import { byId } from "./dom.js";

const SHOWN_MS = 3_500;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showReplyToast(message: string): void {
  const toast = byId("reply-toast", HTMLElement);
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (toast.hidden = true), SHOWN_MS);
}
