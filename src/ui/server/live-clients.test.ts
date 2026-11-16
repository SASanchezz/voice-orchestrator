import assert from "node:assert/strict";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { test } from "node:test";
import { LiveClients } from "./live-clients.js";

/** A response that is never sent anywhere; emitting "close" plays the page going away. */
function pageStream(): ServerResponse {
  return new ServerResponse(new IncomingMessage(new Socket()));
}

test("live clients: a page whose stream is open is open", () => {
  const clients = new LiveClients();
  clients.open(pageStream(), "page-1");
  assert.equal(clients.isOpen("page-1"), true);
});

test("live clients: a page that never opened a stream isn't open", () => {
  const clients = new LiveClients();
  clients.open(pageStream(), "page-1");
  assert.equal(clients.isOpen("page-2"), false);
});

test("live clients: a page whose stream closed isn't open", () => {
  const clients = new LiveClients();
  const stream = pageStream();
  clients.open(stream, "page-1");
  stream.emit("close");
  assert.equal(clients.isOpen("page-1"), false);
});

test("live clients: a stream that named no page leaves the unnamed page closed", () => {
  const clients = new LiveClients();
  clients.open(pageStream());
  assert.equal(clients.isOpen(""), false);
});
