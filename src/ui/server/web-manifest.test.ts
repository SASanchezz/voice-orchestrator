import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { WebManifest } from "./web-manifest.js";

const TOKEN = "t0ken";
const MANIFEST_URL = new URL(`http://127.0.0.1:4777/manifest.webmanifest?token=${TOKEN}`);
const manifestSchema = z.object({ start_url: z.string(), display_override: z.array(z.string()) });

const access = {
  link: () => `http://127.0.0.1:4777/?token=${TOKEN}`,
  requireToken: (candidate: string | string[] | null | undefined) => {
    if (candidate !== TOKEN) throw new HttpError(HTTP_STATUS.unauthorized, "Bad token");
  },
};

function manifestAt(url: URL): z.infer<typeof manifestSchema> {
  return manifestSchema.parse(JSON.parse(new WebManifest(access).contents(url)));
}

test("web manifest: asks Chrome to fold its title bar into the page", () => {
  assert.deepEqual(manifestAt(MANIFEST_URL).display_override, ["window-controls-overlay"]);
});

test("web manifest: the app starts on the page with its access token", () => {
  assert.equal(manifestAt(MANIFEST_URL).start_url, `/?token=${TOKEN}`);
});

test("web manifest: refused without the token", () => {
  assert.throws(() => manifestAt(new URL("http://127.0.0.1:4777/manifest.webmanifest")), HttpError);
});
