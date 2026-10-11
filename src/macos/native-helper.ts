import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { APP_DIR, STATE_DIR } from "../config/paths.js";
import { errorMessage } from "../shared/errors.js";

const run = promisify(execFile);

/** Compile native/<name>.swift into state/bin/<name> once, and again whenever its source changes. */
export async function buildNativeHelper(name: string): Promise<string> {
  const source = resolve(APP_DIR, `native/${name}.swift`);
  const binary = resolve(STATE_DIR, `bin/${name}`);
  if (existsSync(binary) && statSync(binary).mtimeMs > statSync(source).mtimeMs) return binary;
  console.log(`Building the ${name} helper (one time, ~30s)…`);
  mkdirSync(resolve(STATE_DIR, "bin"), { recursive: true });
  try {
    await run("swiftc", ["-O", source, "-o", binary]);
  } catch (e) {
    const hint = `Couldn't compile ${source}. Install the Swift compiler with: xcode-select --install`;
    throw new Error(`${hint}\n${errorMessage(e)}`, { cause: e });
  }
  return binary;
}
