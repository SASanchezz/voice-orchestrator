import { test } from "node:test";
import assert from "node:assert/strict";
import { brain } from "../support/fake-operator.js";
import { app, uiToken, uiUrl, voice } from "../support/harness.js";
import { feedHas, firstChunk, mark, pause, uiPost } from "../support/helpers.js";

const { voiceHold } = app.operator;
const PAGE = "e2e-discard-page";
const POLL_MS = 20;
const SETTLE_MS = 200;

const pageState = async (): Promise<string> => firstChunk(await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl)));

const feedShows = (re: RegExp): boolean => app.ui.feed.recent().some((e) => re.test(e.text));

test("voice discard: what you're saying is discarded from the page", async () => {
  voice.listening = true;
  await uiPost("/api/voice/discard", {});
  assert.equal(voice.listening, false);
});

test("voice discard: a voice message queued behind a reply in progress is shown as queued", async () => {
  const i = mark();
  voice.say("slow: check webshop");
  await voice.heard(/^On it: check webshop\.$/, i);
  voice.say("forget the footer");
  assert.match(await pageState(), /"voiceInput":"queued"/);
});

test("voice discard: a discarded queued message is never answered", async () => {
  const i = mark();
  await uiPost("/api/voice/discard", {});
  brain.finishSlowTurn();
  await voice.heard(/^Done with that\.$/, i);
  await pause(SETTLE_MS);
  assert.equal(feedShows(/^forget the footer$/), false);
});

test("voice discard: with no voice message left before a reply, discarding is refused", async () => {
  assert.notEqual((await uiPost("/api/voice/discard", {})).status, 200);
});

test("voice discard: a message waiting on the draft's files is discarded from its dialog", async () => {
  await uiPost("/api/draft", { page: PAGE, files: 1 });
  voice.say("never mind this one");
  while (!voiceHold.waiting) await pause(POLL_MS);
  await uiPost(`/api/voice-offers/${voiceHold.waiting.id}/discard`, {});
  await uiPost("/api/draft", { page: PAGE, files: 0 });
  await pause(SETTLE_MS);
  assert.equal(feedShows(/^never mind this one$/), false);
});

test("voice discard: after a discard, the next voice message goes as usual", async () => {
  voice.say("status after discard");
  await feedHas(/^status after discard$/);
});
