import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitDefinitions } from "./git-definitions.js";

function repository(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), "git-definitions-"));
  execFileSync("git", ["init"], { cwd: folder, stdio: "ignore" });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text);
  return folder;
}

const places = async (folder: string, symbol: string, file = ""): Promise<string[]> => {
  const definitions = await new GitDefinitions().of(folder, symbol, file);
  return definitions.map(({ path, line }) => `${path}:${line}`);
};

test("definitions: finds a class, leaving out where it's used", async () => {
  const folder = repository({ "a.ts": "class Shop {}\n", "b.ts": "const shop = new Shop();\n" });
  assert.deepEqual(await places(folder, "Shop"), ["a.ts:1"]);
});

test("definitions: a definition comes before an implementation", async () => {
  const folder = repository({ "a.ts": "class B implements Shop {}\n", "z.ts": "\ninterface Shop {}\n" });
  assert.deepEqual(await places(folder, "Shop"), ["z.ts:2", "a.ts:1"]);
});

test("definitions: the asking file comes first among equals", async () => {
  const folder = repository({ "a.ts": "type Shop = 1;\n", "b.ts": "type Shop = 2;\n" });
  assert.deepEqual(await places(folder, "Shop", "b.ts"), ["b.ts:1", "a.ts:1"]);
});

test("definitions: the snippet shows the lines around the definition", async () => {
  const folder = repository({ "a.ts": "// one\n// two\ntype Shop = 1;\n// four\n" });
  const [definition] = await new GitDefinitions().of(folder, "Shop", "");
  assert.deepEqual(definition.snippet.at(2), { line: 3, text: "type Shop = 1;" });
});

test("definitions: secret files are left out", async () => {
  const folder = repository({ ".env": "const Shop = 1\n", "a.ts": "class Shop {}\n" });
  assert.deepEqual(await places(folder, "Shop"), ["a.ts:1"]);
});

test("definitions: a symlink isn't followed out of the project", async () => {
  const outside = repository({ "out.ts": "class Shop {}\n" });
  const folder = repository({});
  symlinkSync(join(outside, "out.ts"), join(folder, "link.ts"));
  assert.deepEqual(await places(folder, "Shop"), []);
});

test("definitions: ignored files are left out", async () => {
  const folder = repository({ ".gitignore": "gen.ts\n", "gen.ts": "class Shop {}\n" });
  assert.deepEqual(await places(folder, "Shop"), []);
});

test("definitions: a name nothing defines has none", async () => {
  assert.deepEqual(await places(repository({ "a.ts": "x\n" }), "Shop"), []);
});

test("definitions: a folder outside any repository has none", async () => {
  const folder = mkdtempSync(join(tmpdir(), "no-repo-"));
  assert.deepEqual(await places(folder, "Shop"), []);
});
