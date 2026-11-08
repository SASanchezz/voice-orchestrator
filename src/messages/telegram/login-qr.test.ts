import assert from "node:assert/strict";
import { test } from "node:test";
import { loginLink } from "./login-qr.js";

test("telegram login QR: the link carries the token in URL-safe base64", () => {
  const token = Buffer.from([0xfb, 0xff, 0x01]);
  assert.equal(loginLink(token), "tg://login?token=-_8B");
});
