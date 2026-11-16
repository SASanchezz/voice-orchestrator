import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { DEFAULT_PROFILE, TestChromeLinks } from "../../testing/test-chrome-links.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { LinkActions } from "./link-actions.js";

const PROFILE_URL = "https://example.com/profile/42";

/** Only "api" has a Chrome profile, as UiLookup answers. */
function chromeProfileOf(project: string): string {
  if (project !== "api") throw new HttpError(HTTP_STATUS.badRequest, `${project} has no Chrome profile set`);
  return "Work";
}

function linkActions(): { actions: LinkActions; chrome: TestChromeLinks } {
  const chrome = new TestChromeLinks();
  return { actions: new LinkActions({ chromeProfileOf }, chrome), chrome };
}

test("link actions: a project's link opens in its Chrome profile", () => {
  const { actions, chrome } = linkActions();
  actions.open({ url: PROFILE_URL, project: "api" });
  assert.deepEqual(chrome.opened, [{ url: PROFILE_URL, chromeProfile: "Work" }]);
});

test("link actions: the answer names the Chrome profile", () => {
  const { actions } = linkActions();
  assert.equal(actions.open({ url: PROFILE_URL, project: "api" }), "Opened in Chrome profile Work.");
});

test("link actions: a profile Chrome lacks opens the link in its default profile", () => {
  const { actions, chrome } = linkActions();
  chrome.missingProfiles = ["Work"];
  actions.open({ url: PROFILE_URL, project: "api" });
  assert.deepEqual(chrome.opened, [{ url: PROFILE_URL, chromeProfile: DEFAULT_PROFILE }]);
});

test("link actions: the answer says the profile was missing", () => {
  const { actions, chrome } = linkActions();
  chrome.missingProfiles = ["Work"];
  assert.match(actions.open({ url: PROFILE_URL, project: "api" }), /no profile named "Work"/);
});

test("link actions: the answer names the profile the link opened in instead", () => {
  const { actions, chrome } = linkActions();
  chrome.missingProfiles = ["Work"];
  assert.match(actions.open({ url: PROFILE_URL, project: "api" }), /opened in \(default\)/);
});

test("link actions: a project without a Chrome profile is refused", () => {
  const { actions } = linkActions();
  assert.throws(() => actions.open({ url: PROFILE_URL, project: "shop" }), HttpError);
});

test("link actions: only web addresses are opened", () => {
  const { actions } = linkActions();
  assert.throws(() => actions.open({ url: "file:///etc/passwd", project: "api" }), z.ZodError);
});
