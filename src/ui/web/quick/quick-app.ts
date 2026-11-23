// The quick panel's page: brought up from any app by a key combo, it writes to a worker session or the assistant.
// Each showing starts on the box; an unsent message stays, with who it was for, until you send it or empty the box.

import { onServerEvent, openEvents } from "../api.js";
import { BoxNews } from "../box-news.js";
import { DictationBox } from "../dictation-box.js";
import { autoGrow, byId } from "../dom.js";
import { hidePanel, followPanelShowing, reportHeight } from "../notice/panel-bridge.js";
import { reportPageHidden, reportPageUse } from "../page-use-report.js";
import { store } from "../store.js";
import { QuickComposer } from "./quick-composer.js";
import { QuickHeader } from "./quick-header.js";
import { wireQuickKeys } from "./quick-keys.js";
import { QuickPicker } from "./quick-picker.js";
import { QuickStatus } from "./quick-status.js";
import { TargetChoice } from "./target-choice.js";
import { ASSISTANT_TARGET } from "../../quick-targets.js";
import type { FeedEntryView } from "../../protocol.js";

/** Long enough to read where it went, short enough not to wait for. */
const SENT_NOTE_MS = 700;

const input = byId("quick-input", HTMLTextAreaElement);
const form = byId("quick-form", HTMLFormElement);
const choice = new TargetChoice();
const status = new QuickStatus();
const header = new QuickHeader(pick);
const picker = new QuickPicker(() => choice.everyone(), pick);
const box = new DictationBox({
  input,
  mic: byId("quick-mic", HTMLButtonElement),
  cancel: byId("quick-mic-cancel", HTMLButtonElement),
  send: byId("quick-send", HTMLButtonElement),
});
const composer = new QuickComposer(box, status, choice);
/** Saying "finish" sends, as ↩ does. */
const news = new BoxNews(box, { describe: () => "", send: () => void send() });

function render(): void {
  header.render(choice.current(), choice.sessions());
  byId("quick-mic", HTMLButtonElement).hidden = store.state.gestures === "unavailable"; // text mode has no mic
}

function pick(id: string): void {
  choice.pick(id);
  status.clear();
  render();
  input.focus();
}

/** The recent sessions as the chips under the box list them; a place with no session does nothing. */
function pickRecent(place: number): void {
  const target = choice.sessions().at(place);
  if (target) pick(target.id);
}

async function send(): Promise<void> {
  if (await composer.send()) putAwaySoon();
}

async function sendToNewSession(): Promise<void> {
  if (await composer.sendToNewSession()) putAwaySoon();
}

/** Unless you started writing another message meanwhile. */
function putAwaySoon(): void {
  render();
  setTimeout(() => {
    if (!composer.hasWords()) hidePanel();
  }, SENT_NOTE_MS);
}

/** A fresh start with an empty box goes back to the default; an unsent message keeps who it was for. */
function shown(): void {
  picker.close();
  status.clear();
  if (!composer.hasWords()) choice.forgetPick();
  render();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  reportPageUse(); // your spoken words come here while it's up
}

function hidden(): void {
  picker.close();
  reportPageHidden();
}

function escape(): void {
  if (picker.isOpen()) return picker.close();
  hidePanel();
}

function togglePicker(): void {
  if (!picker.isOpen()) return picker.open();
  picker.close();
  input.focus();
}

/** ↩ sends, ⇧↩ adds a line; "@" in an empty box opens the list, as mentioning someone does. */
function wireBox(): void {
  box.wire(form); // first: while recording, ↩ stops it instead
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void send();
  });
  input.addEventListener("keydown", onBoxKey);
  input.addEventListener("input", () => {
    autoGrow(input);
    status.clear();
  });
}

function onBoxKey(e: KeyboardEvent): void {
  if (e.isComposing) return;
  const isMention = e.key === "@" && !composer.hasWords();
  const isSend = e.key === "Enter" && !e.shiftKey && !e.metaKey;
  if (!isMention && !isSend) return;
  e.preventDefault();
  if (isMention) picker.open();
  else void send();
}

function rememberAssistantReplies(entries: FeedEntryView[]): void {
  const reply = entries.findLast((entry) => entry.kind === "orchestrator");
  if (reply) header.rememberAssistantReply(reply.text);
  render();
}

function connect(): void {
  const events = openEvents();
  onServerEvent(events, "state", (state) => store.receive(state));
  onServerEvent(events, "backlog", rememberAssistantReplies);
  onServerEvent(events, "feed", (entry) => rememberAssistantReplies([entry]));
  news.follow(events);
}

store.onChange(render);
wireBox();
wireQuickKeys({
  togglePicker,
  pickRecent,
  pickAssistant: () => pick(ASSISTANT_TARGET.id),
  sendToNewSession: () => void sendToNewSession(),
  escape,
  close: hidePanel,
});
byId("quick-target", HTMLButtonElement).addEventListener("click", togglePicker);
followPanelShowing(shown, hidden);
reportHeight(byId("quick-options", HTMLElement), byId("quick", HTMLElement));
render();
connect();
