import { test } from "node:test";
import assert from "node:assert/strict";
import { testConfig } from "../testing/test-config.js";
import { resolveProject } from "./project-names.js";

const cfg = testConfig({
  projects: { webshop: { path: "/x", profile: "personal" }, dbadmin: { path: "/y", profile: "personal" } },
});

test("a spoken name with spaces and punctuation finds its project", () => {
  assert.equal(resolveProject(cfg, "Web shop."), "webshop");
});

test("a spoken name in another case finds its project", () => {
  assert.equal(resolveProject(cfg, "DB admin"), "dbadmin");
});

test("an unknown spoken name finds nothing", () => {
  assert.equal(resolveProject(cfg, "billing"), undefined);
});
