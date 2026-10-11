import { loginCommand } from "../config/accounts.js";
import type { AppConfig } from "../config/app-config.js";
import { checkAuth } from "../config/auth-status.js";

const PROFILE_COLUMN = 10;

/** Fail fast on logins instead of hearing "Not logged in" from every session. Exits if the orchestrator's account is out. */
export async function checkLogins(cfg: AppConfig): Promise<void> {
  console.log(`Claude binary: ${cfg.claudeBin ?? "(SDK bundled)"}`);
  const statuses = await checkAuth(cfg);
  for (const s of statuses)
    console.log(`  ${s.loggedIn ? "✓" : "✗"} ${s.profile.padEnd(PROFILE_COLUMN)} ${s.configDir}  ${s.detail}`);
  const loggedOut = statuses.filter((s) => !s.loggedIn);
  for (const s of loggedOut) console.log(`\n  Fix ${s.profile}:  ${loginCommand(s.configDir)}`);
  if (loggedOut.some((s) => s.profile === cfg.orchestrator.profile)) exitForOrchestratorLogin(cfg);
  if (loggedOut.length) console.log("\nProjects on a logged-out account will fail until you log in.\n");
}

function exitForOrchestratorLogin(cfg: AppConfig): never {
  const { profile } = cfg.orchestrator;
  console.log(
    `\nThe orchestrator account (${profile}) must be logged in. If you log in under a different folder, fix profiles.${profile}.configDir in config/config.yaml.`,
  );
  process.exit(1);
}
