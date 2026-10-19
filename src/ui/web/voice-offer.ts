// While files wait in this page's draft, your voice message waits too: a dialog asks whether they go with it or stay
// in the draft. Talking goes on meanwhile; what you say joins the message, and it never waits long.

import { VOICE_MESSAGE_WAIT_MS } from "../../attachments/attachment-limits.js";
import type { VoiceOfferView } from "../protocol.js";
import { act } from "./api.js";
import { type AttachmentTray, encodeForSending } from "./attachments.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

const SEND_WITH_FILES = "confirm";
const DISCARD_MESSAGE = "discard";
const SECOND_MS = 1000;
/** The voice message the dialog is open for; unset before the page closes the dialog itself, so that sends nothing. */
let shownId: string | undefined;

/** Opens the dialog while a voice message waits and this draft has files; closes it once the message has gone. */
export function renderVoiceOffer(tray: AttachmentTray): void {
  const offer = store.state.voiceOffer;
  if (offer && !tray.isEmpty) showOffer(offer, tray);
  else closeOffer();
}

function showOffer(offer: VoiceOfferView, tray: AttachmentTray): void {
  byId("voice-offer-text", HTMLElement).textContent = `“${offer.text}”`;
  byId("voice-offer-files", HTMLElement).textContent = waitingFilesLine(tray.count);
  if (shownId === offer.id) return;
  shownId = offer.id;
  const dialog = byId("voice-offer-dialog", HTMLDialogElement);
  dialog.returnValue = "";
  dialog.addEventListener("close", () => void choose(offer.id, dialog.returnValue, tray), { once: true });
  if (!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLButtonElement>(".primary")?.focus();
}

function closeOffer(): void {
  if (shownId === undefined) return;
  shownId = undefined;
  byId("voice-offer-dialog", HTMLDialogElement).close();
}

/** Escape counts as keeping the files in the draft. */
async function choose(id: string, choice: string, tray: AttachmentTray): Promise<void> {
  if (shownId !== id) return; // the message already went
  shownId = undefined;
  if (choice === SEND_WITH_FILES) return sendWithFiles(id, tray);
  if (choice === DISCARD_MESSAGE) return discard(id);
  await keepInDraft(id);
}

async function sendWithFiles(id: string, tray: AttachmentTray): Promise<void> {
  const attachments = await encodeForSending(tray.attached);
  if (!attachments) return keepInDraft(id);
  const sent = await act(`/api/voice-offers/${id}/attach`, { attachments });
  if (sent !== undefined) tray.clear();
}

async function keepInDraft(id: string): Promise<void> {
  await act(`/api/voice-offers/${id}/keep`);
}

async function discard(id: string): Promise<void> {
  await act(`/api/voice-offers/${id}/discard`);
}

function waitingFilesLine(files: number): string {
  const waiting = files === 1 ? "1 file is" : `${files} files are`;
  const seconds = VOICE_MESSAGE_WAIT_MS / SECOND_MS;
  return `${waiting} in the draft. You can keep talking; without a choice in ${seconds} seconds, the message goes without them.`;
}
