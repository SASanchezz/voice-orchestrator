import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { RESTART_EXIT_CODE, RESTARTED_ENV } from "./app/restart.js";

/**
 * Runs the app and starts it again whenever it exits asking for a restart.
 * The old process is fully gone (port, hotkey helper, workers) before the new one starts, so nothing runs twice.
 */
const MAIN = resolve(import.meta.dirname, "main.ts");
const args = process.argv.slice(2);

// Ctrl+C reaches the app too (same terminal process group); it shuts down and this supervisor follows.
process.on("SIGINT", () => {});

startApp(false);

function startApp(restarted: boolean) {
  const env = restarted ? { ...process.env, [RESTARTED_ENV]: "1" } : process.env;
  const app = spawn(process.execPath, ["--import", "tsx", MAIN, ...args], { stdio: "inherit", env });
  const stopApp = () => app.kill("SIGINT");
  process.once("SIGTERM", stopApp);
  app.once("exit", (code, signal) => {
    process.off("SIGTERM", stopApp);
    if (code === RESTART_EXIT_CODE) return startApp(true);
    process.exit(code ?? (signal ? 1 : 0));
  });
}
