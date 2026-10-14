import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DailySpend } from "./daily-spend.js";

const tempFile = () => join(mkdtempSync(join(tmpdir(), "vo-spend-")), "spend.json");
const OCT_14 = new Date(2026, 9, 14, 12);
const OCT_15 = new Date(2026, 9, 15, 9);

test("daily spend: a day's spending adds up", () => {
  const spend = new DailySpend(tempFile());
  spend.add(1.5, OCT_14);
  spend.add(2, OCT_14);
  assert.equal(spend.spentOn(OCT_14), 3.5);
});

test("daily spend: each day starts at zero", () => {
  const spend = new DailySpend(tempFile());
  spend.add(1.5, OCT_14);
  assert.equal(spend.spentOn(OCT_15), 0);
});

test("daily spend: survives a restart", () => {
  const file = tempFile();
  new DailySpend(file).add(4, OCT_14);
  assert.equal(new DailySpend(file).spentOn(OCT_14), 4);
});

test("daily spend: a damaged file starts the count over", () => {
  const file = tempFile();
  writeFileSync(file, "{not json");
  assert.equal(new DailySpend(file).spentOn(OCT_14), 0);
});
