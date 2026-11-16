import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppConfig } from "./app-config.js";
import { testConfig } from "../testing/test-config.js";
import { moveToOrchestratorAccount, projectsOnUnknownAccounts } from "./project-accounts.js";

function configWithTypo(): AppConfig {
  return testConfig({
    profiles: { personal: { configDir: "/c" }, work: { configDir: "/w" } },
    projects: { api: { path: "/code/api", profile: "work" }, shop: { path: "/code/shop", profile: "Prewins" } },
  });
}

test("project accounts: a project naming no known account is found", () => {
  assert.deepEqual(projectsOnUnknownAccounts(configWithTypo()), ["shop"]);
});

test("project accounts: a moved project runs on the orchestrator's account", () => {
  const cfg = configWithTypo();
  moveToOrchestratorAccount(cfg, "shop");
  assert.equal(cfg.projects.shop.profile, "personal");
});
