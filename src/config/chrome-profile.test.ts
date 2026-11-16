import assert from "node:assert/strict";
import { test } from "node:test";
import { chromeProfileOf, type ChromeProfileSettings } from "./chrome-profile.js";

function settings(): ChromeProfileSettings {
  return {
    profiles: {
      personal: { configDir: "/home/.claude" },
      work: { configDir: "/home/.claude-work", chromeProfile: "Work" },
    },
    projects: {
      shop: { path: "/code/shop", profile: "personal" },
      api: { path: "/code/api", profile: "work" },
      client: { path: "/code/client", profile: "work", chromeProfile: "Client X" },
    },
  };
}

test("chrome profile: a project takes its account's Chrome profile", () => {
  assert.equal(chromeProfileOf(settings(), "api"), "Work");
});

test("chrome profile: a project's own Chrome profile wins over its account's", () => {
  assert.equal(chromeProfileOf(settings(), "client"), "Client X");
});

test("chrome profile: a project whose account names none has none", () => {
  assert.equal(chromeProfileOf(settings(), "shop"), undefined);
});

test("chrome profile: an unknown project has none", () => {
  assert.equal(chromeProfileOf(settings(), "missing"), undefined);
});
