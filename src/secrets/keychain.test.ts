import assert from "node:assert/strict";
import { test } from "node:test";
import { Keychain, type CommandRunner } from "./keychain.js";

const SECRET = "xoxp-very-secret";

function printing(stdout: string): CommandRunner {
  return async () => ({ stdout });
}

function failingWith(code: number): CommandRunner {
  return async () => {
    throw Object.assign(new Error(`security failed: ${SECRET}`), { code });
  };
}

test("keychain: reads the password without its trailing newline", async () => {
  assert.equal(await new Keychain(printing(`${SECRET}\n`)).read("svc", "acme"), SECRET);
});

test("keychain: asks security for the service and account's password only", async () => {
  const calls: string[][] = [];
  const recording: CommandRunner = async (file, args) => {
    calls.push([file, ...args]);
    return { stdout: SECRET };
  };
  await new Keychain(recording).read("svc", "acme");
  assert.deepEqual(calls, [["/usr/bin/security", "find-generic-password", "-s", "svc", "-a", "acme", "-w"]]);
});

test("keychain: a missing item says how to add it", async () => {
  await assert.rejects(
    new Keychain(failingWith(44)).read("svc", "acme"),
    /No Keychain item "svc".*add-generic-password/,
  );
});

test("keychain: a failed read never repeats the command's output", async () => {
  await assert.rejects(
    new Keychain(failingWith(1)).read("svc", "acme"),
    (error: Error) => !error.message.includes(SECRET),
  );
});

test("keychain: an empty item is an error", async () => {
  await assert.rejects(new Keychain(printing("\n")).read("svc", "acme"), /is empty/);
});

test("keychain: an existing item is found without reading its value", async () => {
  const calls: string[][] = [];
  const recording: CommandRunner = async (_file, args) => {
    calls.push(args);
    return { stdout: "attributes" };
  };
  assert.equal(await new Keychain(recording).has("svc", "acme"), true);
  assert.ok(!calls[0].includes("-w"));
});

test("keychain: a missing item is reported as absent", async () => {
  assert.equal(await new Keychain(failingWith(44)).has("svc", "acme"), false);
});
