import { test } from "node:test";
import assert from "node:assert/strict";
import { app, uiToken, uiUrl, voice } from "../support/harness.js";
import { feedHas, firstChunk, pause, uiPost } from "../support/helpers.js";

const { voiceHold } = app.operator;
const PAGE = "e2e-page";
const POLL_MS = 20;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

const attachment = (name: string, content: Buffer): { name: string; data: string } => ({
  name,
  data: content.toString("base64"),
});

/** Says `words` while this page's draft has a file; resolves with the waiting message's id. */
async function sayWithDraft(words: string): Promise<string> {
  await uiPost("/api/draft", { page: PAGE, files: 1 });
  voice.say(words);
  while (!voiceHold.waiting) await pause(POLL_MS);
  return voiceHold.waiting.id;
}

const imageUrl = (path: string, token = uiToken): URL =>
  new URL(`/api/attachments?path=${encodeURIComponent(path)}&token=${token}`, uiUrl);

function sentImagePath(): string {
  const entry = app.ui.feed.recent().find((e) => /\/look\.png \(1 KB\)/.test(e.text));
  return entry?.text.match(/- (\S+\/look\.png)/)?.[1] ?? "";
}

test("voice attachments: with files in the draft, the page is asked about the voice message", async () => {
  await sayWithDraft("look at this picture");
  const res = await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl));
  assert.match(await firstChunk(res), /"voiceOffer":\{"id":"\d+","text":"look at this picture"\}/);
});

test("voice attachments: kept in the draft, the voice message goes on its own", async () => {
  await uiPost(`/api/voice-offers/${voiceHold.waiting?.id ?? ""}/keep`, {});
  await feedHas(/^look at this picture$/);
});

test("voice attachments: sent with the message, the files are listed after what you said", async () => {
  const id = await sayWithDraft("what is on this");
  await uiPost(`/api/voice-offers/${id}/attach`, { attachments: [attachment("look.png", PNG)] });
  await feedHas(/^what is on this\n\nAttached files:\n- \S+\/look\.png \(1 KB\)$/);
});

test("voice attachments: an answer for a message that already went is refused", async () => {
  assert.notEqual((await uiPost("/api/voice-offers/1/keep", {})).status, 200);
});

test("voice attachments: once the draft is empty, voice goes at once again", async () => {
  await uiPost("/api/draft", { page: PAGE, files: 0 });
  voice.say("status");
  assert.equal(voiceHold.waiting, undefined);
});

test("attached images: the page loads a sent image by its path", async () => {
  const res = await fetch(imageUrl(sentImagePath()));
  assert.equal(res.headers.get("content-type"), "image/png");
});

test("attached images: loading one needs the token", async () => {
  assert.equal((await fetch(imageUrl(sentImagePath(), "wrong"))).status, 401);
});

test("attached images: nothing outside the attachments folder is served", async () => {
  assert.notEqual((await fetch(imageUrl("/etc/hosts"))).status, 200);
});
