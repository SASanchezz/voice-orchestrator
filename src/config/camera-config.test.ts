import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraSchema } from "./camera-config.js";

test("camera config: Claude looks at the frames without a camera section", () => {
  assert.equal(cameraSchema.parse(undefined).describer, "claude");
});

test("camera config: an empty vision server key gets llama-server's address", () => {
  assert.equal(cameraSchema.parse({ visionServer: null }).visionServer, "http://127.0.0.1:8080");
});

test("camera config: an unknown describer is rejected", () => {
  assert.throws(() => cameraSchema.parse({ describer: "gpt" }));
});

test("camera config: a vision server that isn't a URL is rejected", () => {
  assert.throws(() => cameraSchema.parse({ visionServer: "localhost 8080" }));
});
