import { test } from "node:test";
import assert from "node:assert/strict";
import type { CameraFrame } from "./camera-source.js";
import { LlamaDescriber } from "./llama-describer.js";
import { DESCRIBE_FOR_ASSISTANT } from "./vision-prompts.js";

const SERVER = "http://127.0.0.1:8080";
const FRAME: CameraFrame = { data: "ZmFrZQ==", mimeType: "image/jpeg" };
const DESCRIPTION = "A red mug with the word 'Monday'.";
const REPLY = { choices: [{ index: 0, message: { role: "assistant", content: DESCRIPTION } }] };

/** Stands in for llama-server: answers every request with `response`, and remembers where it was sent. */
class FakeServer {
  urls: string[] = [];

  constructor(private response: () => Response) {}

  post: typeof fetch = async (url) => {
    this.urls.push(url instanceof Request ? url.url : url.toString());
    return this.response();
  };
}

const answering = (status: number, body: unknown): FakeServer =>
  new FakeServer(() => new Response(JSON.stringify(body), { status }));

const unreachable = new FakeServer(() => {
  throw new TypeError("fetch failed");
});

const describerOn = (server: FakeServer): LlamaDescriber =>
  new LlamaDescriber(SERVER, server.post, DESCRIBE_FOR_ASSISTANT);

test("llama describer: the frame goes to the server's chat endpoint", async () => {
  const server = answering(200, REPLY);
  await describerOn(server).describe(FRAME, "what is this?");
  assert.deepEqual(server.urls, [`${SERVER}/v1/chat/completions`]);
});

test("llama describer: the model's words are the description", async () => {
  const describer = describerOn(answering(200, REPLY));
  assert.equal(await describer.describe(FRAME, "what is this?"), DESCRIPTION);
});

test("llama describer: a server error says what the server answered", async () => {
  const describer = describerOn(answering(500, "model not loaded"));
  await assert.rejects(describer.describe(FRAME, "what is this?"), /answered 500/);
});

test("llama describer: a server that isn't running says where it was looked for", async () => {
  const describer = describerOn(unreachable);
  await assert.rejects(describer.describe(FRAME, "what is this?"), /not reachable/);
});
