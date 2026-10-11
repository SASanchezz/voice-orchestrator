import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { errorMessage } from "../shared/errors.js";
import type { AppConfig } from "./app-config.js";
import { envForProfile } from "./accounts.js";

const run = promisify(execFile);

const AUTH_CHECK_TIMEOUT_MS = 20_000;

export interface AuthStatus {
  profile: string;
  configDir: string;
  loggedIn: boolean;
  detail: string;
}

/** What `claude auth status --json` prints; field names vary between versions. */
const statusSchema = z.looseObject({
  loggedIn: z.unknown().optional(),
  email: z.unknown().optional(),
  account: z.unknown().optional(),
  organizationName: z.unknown().optional(),
  orgName: z.unknown().optional(),
  authMethod: z.unknown().optional(),
});
type StatusOutput = z.infer<typeof statusSchema>;

/** `claude auth status --json` for each profile, run exactly as the workers will run. */
export async function checkAuth(cfg: AppConfig, profiles = Object.keys(cfg.profiles)): Promise<AuthStatus[]> {
  return Promise.all(profiles.map((profile) => authStatusOf(cfg, profile)));
}

async function authStatusOf(cfg: AppConfig, profile: string): Promise<AuthStatus> {
  try {
    return await readAuthStatus(cfg, profile);
  } catch (error) {
    return statusAfterFailure(profile, cfg.profiles[profile].configDir, error);
  }
}

async function readAuthStatus(cfg: AppConfig, profile: string): Promise<AuthStatus> {
  const args = ["auth", "status", "--json"];
  const options = { env: envForProfile(cfg, profile), timeout: AUTH_CHECK_TIMEOUT_MS };
  const { stdout } = await run(cfg.claudeBin ?? "claude", args, options);
  const status = parseStatus(stdout);
  const { configDir } = cfg.profiles[profile];
  return { profile, configDir, loggedIn: Boolean(status.loggedIn), detail: String(accountName(status)) };
}

/** A failed check may still have printed a status (e.g. logged out exits non-zero). */
function statusAfterFailure(profile: string, configDir: string, error: unknown): AuthStatus {
  try {
    return { profile, configDir, loggedIn: Boolean(parseStatus(stdoutOf(error)).loggedIn), detail: "" };
  } catch {
    return { profile, configDir, loggedIn: false, detail: errorMessage(error).split("\n")[0] };
  }
}

function parseStatus(stdout: string): StatusOutput {
  return statusSchema.parse(JSON.parse(stdout.slice(stdout.indexOf("{"))));
}

function accountName(status: StatusOutput): unknown {
  return (
    status.email ?? emailOf(status.account) ?? status.organizationName ?? status.orgName ?? status.authMethod ?? ""
  );
}

function emailOf(account: unknown): unknown {
  return typeof account === "object" && account !== null && "email" in account ? account.email : undefined;
}

function stdoutOf(error: unknown): string {
  return String(typeof error === "object" && error !== null && "stdout" in error ? error.stdout : undefined);
}
