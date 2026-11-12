import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { APP_DIR, STATE_DIR } from "../config/paths.js";
import { errorMessage } from "../shared/errors.js";

const run = promisify(execFile);

/** Code from native/shared/ that a helper is compiled together with, by helper name. */
const SHARED_SOURCES: Record<string, string[]> = {
  "popup-panel": ["glass"],
  "notice-panel": ["glass"],
};

/** Compile native/<name>.swift (and its shared code) into state/bin/<name> once, and again whenever a source changes. */
export async function buildNativeHelper(name: string): Promise<string> {
  const source = resolve(APP_DIR, `native/${name}.swift`);
  const shared = (SHARED_SOURCES[name] ?? []).map((file) => resolve(APP_DIR, `native/shared/${file}.swift`));
  const binary = resolve(STATE_DIR, `bin/${name}`);
  if (isNewerThanAll(binary, [source, ...shared])) return binary;
  console.log(`Building the ${name} helper (one time, ~30s)…`);
  mkdirSync(resolve(STATE_DIR, "bin"), { recursive: true });
  try {
    await compile(source, shared, binary);
  } catch (e) {
    const hint = `Couldn't compile ${source}. Install the Swift compiler with: xcode-select --install`;
    throw new Error(`${hint}\n${errorMessage(e)}`, { cause: e });
  }
  return binary;
}

function isNewerThanAll(binary: string, sources: string[]): boolean {
  if (!existsSync(binary)) return false;
  const built = statSync(binary).mtimeMs;
  return sources.every((source) => statSync(source).mtimeMs < built);
}

/**
 * Swift runs top-level code only from a file named main.swift once more than one file is compiled,
 * so the helper's own source is compiled from a copy under that name.
 */
async function compile(source: string, shared: string[], binary: string): Promise<void> {
  if (shared.length === 0) {
    await run("swiftc", ["-O", source, "-o", binary]);
    return;
  }
  const workDir = mkdtempSync(join(tmpdir(), "native-helper-"));
  try {
    const main = join(workDir, "main.swift");
    copyFileSync(source, main);
    await run("swiftc", ["-O", main, ...shared, "-o", binary]);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
