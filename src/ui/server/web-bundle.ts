import { build } from "esbuild";
import { resolve } from "node:path";
import { APP_DIR } from "../../config/paths.js";

const ENTRY = resolve(APP_DIR, "src/ui/web/app.ts");

/**
 * Compiles the page's TypeScript (src/ui/web/) into one browser script, in memory.
 * Done when the UI server starts, so there is no separate build step and a restart picks up changes.
 * This strips types without checking them; `npm run typecheck` does that.
 */
export async function bundleWebApp(): Promise<string> {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: "inline",
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}
