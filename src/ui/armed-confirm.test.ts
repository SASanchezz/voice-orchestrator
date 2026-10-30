import { test } from "node:test";
import assert from "node:assert/strict";
import { ArmedConfirm } from "./armed-confirm.js";

const WAIT_MS = 4000;

function confirmer(): ArmedConfirm {
  return new ArmedConfirm(WAIT_MS, () => {});
}

test("armed confirm: nothing is armed at first", () => {
  assert.equal(confirmer().isArmed("a"), false);
});

test("armed confirm: arming arms that one", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  assert.equal(confirm.isArmed("a"), true);
});

test("armed confirm: arming another disarms the first", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  confirm.arm("b");
  assert.equal(confirm.isArmed("a"), false);
});

test("armed confirm: it stays armed until the wait is over", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  t.mock.timers.tick(WAIT_MS - 1);
  assert.equal(confirm.isArmed("a"), true);
});

test("armed confirm: waiting disarms it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  t.mock.timers.tick(WAIT_MS);
  assert.equal(confirm.isArmed("a"), false);
});

test("armed confirm: cancelling disarms it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  confirm.cancel();
  assert.equal(confirm.isArmed("a"), false);
});

test("armed confirm: an old wait can't disarm a newer arming", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const confirm = confirmer();
  confirm.arm("a");
  t.mock.timers.tick(WAIT_MS - 1);
  confirm.arm("a");
  t.mock.timers.tick(WAIT_MS - 1);
  assert.equal(confirm.isArmed("a"), true);
});

test("armed confirm: the page hears when it is armed and when it expires", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let changes = 0;
  const confirm = new ArmedConfirm(WAIT_MS, () => (changes += 1));
  confirm.arm("a");
  t.mock.timers.tick(WAIT_MS);
  assert.equal(changes, 2);
});

test("armed confirm: cancelling with nothing armed changes nothing", () => {
  let changes = 0;
  new ArmedConfirm(WAIT_MS, () => (changes += 1)).cancel();
  assert.equal(changes, 0);
});
