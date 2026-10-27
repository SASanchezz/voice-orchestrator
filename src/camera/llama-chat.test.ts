import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { CameraFrame } from "./camera-source.js";
import { chatRequest, replyText } from "./llama-chat.js";
import { ANSWER_ALOUD } from "./vision-prompts.js";

const FRAME: CameraFrame = { data: "ZmFrZQ==", mimeType: "image/jpeg" };
const QUESTION = "what am I holding?";

/** The parts of the OpenAI chat format these tests look at; extra fields are allowed. */
const sentSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.unknown() })),
  max_tokens: z.number(),
});
const userPartsSchema = z.array(
  z.union([
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string() }) }),
  ]),
);

function sent(): z.infer<typeof sentSchema> {
  return sentSchema.parse(chatRequest(FRAME, QUESTION, ANSWER_ALOUD));
}

function userParts(): z.infer<typeof userPartsSchema> {
  const userMessage = sent().messages.find((message) => message.role === "user");
  return userPartsSchema.parse(userMessage?.content);
}

function choice(content: string): unknown {
  return { choices: [{ index: 0, message: { role: "assistant", content } }], usage: { total_tokens: 9 } };
}

test("llama chat: the model is told how to answer first", () => {
  assert.deepEqual(sent().messages[0], { role: "system", content: ANSWER_ALOUD.system });
});

test("llama chat: the frame goes inline as a data URL", () => {
  const image = userParts().find((part) => part.type === "image_url");
  assert.equal(image?.image_url.url, `data:image/jpeg;base64,${FRAME.data}`);
});

test("llama chat: the user's question goes along with the frame", () => {
  const question = userParts().find((part) => part.type === "text");
  assert.equal(question?.text, QUESTION);
});

test("llama chat: the reply length is capped", () => {
  assert.equal(sent().max_tokens, ANSWER_ALOUD.maxTokens);
});

test("llama chat: the description is the first choice's text, trimmed", () => {
  assert.equal(replyText(choice("  A red mug.\n")), "A red mug.");
});

test("llama chat: a reply without choices is an error", () => {
  assert.throws(() => replyText({ error: { message: "model not loaded" } }));
});

test("llama chat: an empty description is an error", () => {
  assert.throws(() => replyText(choice("   ")));
});
