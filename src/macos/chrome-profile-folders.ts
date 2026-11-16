import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { z } from "zod";

/** Chrome's list of its profiles: each profile's folder, with the name Chrome shows for it. */
export const CHROME_LOCAL_STATE = resolve(homedir(), "Library/Application Support/Google/Chrome/Local State");

const localStateSchema = z.object({
  profile: z.object({ info_cache: z.record(z.string(), z.object({ name: z.string() })) }),
});

/** The folder Chrome makes for its first profile; links whose profile Chrome lacks open there. */
export const DEFAULT_CHROME_FOLDER = "Default";

export function hasChromeProfile(localStatePath: string, profile: string): boolean {
  return Boolean(findProfileFolder(localStatePath, profile));
}

/** The folder of the Chrome profile with this name, or with this folder name ("Profile 2"); throws without one. */
export function chromeProfileFolder(localStatePath: string, profile: string): string {
  const found = findProfileFolder(localStatePath, profile);
  if (!found) throw new Error(`Chrome has no profile named "${profile}"`);
  return found;
}

/** The name Chrome shows for the profile in this folder; the folder's own name when Chrome lists none. */
export function profileNameOf(localStatePath: string, folder: string): string {
  return readProfiles(localStatePath)[folder]?.name ?? folder;
}

function findProfileFolder(localStatePath: string, profile: string): string | undefined {
  const folders = Object.entries(readProfiles(localStatePath));
  return folders.find(([folder, { name }]) => folder === profile || name === profile)?.[0];
}

function readProfiles(localStatePath: string): Record<string, { name: string }> {
  const localState = localStateSchema.parse(JSON.parse(readFileSync(localStatePath, "utf8")));
  return localState.profile.info_cache;
}
