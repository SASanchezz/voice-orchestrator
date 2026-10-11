import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { brain } from "../support/fake-operator.js";
import { app, uiUrl, voice } from "../support/harness.js";
import { feedHas, mark, pause, uiPost } from "../support/helpers.js";

const { permissions, workers } = app;

test("ui: the page needs the token from the printed link", async () => {
  assert.equal((await fetch(new URL("/", uiUrl))).status, 401);
  assert.equal((await fetch(uiUrl)).status, 200);
});

test("ui: the page's script is served as JavaScript", async () => {
  assert.equal((await fetch(new URL("/app.js", uiUrl))).headers.get("content-type"), "text/javascript");
});

test("ui: the page's script is compiled from TypeScript into one file", async () => {
  const script = await (await fetch(new URL("/app.js", uiUrl))).text();
  assert.deepEqual(
    [/new ChatView\(\)/.test(script), /^import /m.test(script), /: HTMLElement\b/.test(script)],
    [true, false, false],
  );
});

test("ui: actions need the token", async () => {
  assert.equal((await uiPost("/api/message", { text: "status" }, "wrong")).status, 401);
});

test("ui: requests for another host name are refused (DNS rebinding)", async () => {
  const options = {
    host: "127.0.0.1",
    port: uiUrl.port,
    path: uiUrl.pathname + uiUrl.search,
    headers: { host: "evil.example" },
  };
  const status = await new Promise<number>((ok) => httpRequest(options, (r) => ok(r.statusCode!)).end());
  assert.equal(status, 403);
});

test("ui: a typed message is answered in the feed, not spoken", async () => {
  const i = mark();
  assert.equal((await uiPost("/api/message", { text: "status" })).status, 200);
  await feedHas(/dbadmin \[personal\]/);
  await pause(100);
  assert.equal(voice.spoken.length, i);
});

test("ui: a destructive request is allowed once by click, never 'always'", async () => {
  workers.intake.run("dbadmin", "run: mkdir -p tmpx && rm -rf tmpx");
  while (!permissions.views.requests().some((r) => r.destructiveVerb === "delete")) await pause(20);
  const id = permissions.views.requests()[0].id;
  assert.match(
    await (await uiPost(`/api/permissions/${id}`, { decision: "always" })).text(),
    /can't be always-allowed/,
  );
  assert.match(await (await uiPost(`/api/permissions/${id}`, { decision: "once" })).text(), /Allowed once/);
  await feedHas(/^finished its task$/);
});

test("ui: what you click is passed to the model with its next message", async () => {
  await uiPost("/api/message", { text: "status" });
  await pause(200);
  const clicked = /^\[UI\] Allowed once: dbadmin: Bash: mkdir -p tmpx && rm -rf tmpx \(request p\d+\)$/;
  assert.ok(
    brain.notesSeen.some((n) => clicked.test(n)),
    brain.notesSeen.join("\n"),
  );
});
