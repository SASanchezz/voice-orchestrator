import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

/** Desktop VS Code's theme when none is set; VS Code for the web would start light instead. */
export const DESKTOP_DEFAULT_THEME = "Default Dark Modern";
export const DESKTOP_SETTINGS = resolve(homedir(), "Library/Application Support/Code/User/settings.json");

/** Read without a JSONC parser: settings files may hold comments, and only this one string is wanted from it. */
const DESKTOP_THEME_LINE = /"workbench\.colorTheme"\s*:\s*"([^"]+)"/;

/** Your desktop VS Code's color theme, which the Code view starts with. */
export function desktopColorTheme(settingsFile = DESKTOP_SETTINGS): string {
  if (!existsSync(settingsFile)) return DESKTOP_DEFAULT_THEME;
  return DESKTOP_THEME_LINE.exec(readFileSync(settingsFile, "utf8"))?.[1] ?? DESKTOP_DEFAULT_THEME;
}
