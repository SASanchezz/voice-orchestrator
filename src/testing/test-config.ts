import type { AppConfig } from "../config/app-config.js";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import { DEFAULT_SENSORS } from "../config/sensor-config.js";

const BASE: AppConfig = {
  orchestrator: { profile: "personal", resetMinutes: 60, rules: [], answerWindowSeconds: 0 },
  profiles: { personal: { configDir: "/c" } },
  projects: {},
  searchRoots: [],
  voice: {
    hotkey: "x",
    recordBin: "x",
    whisperBin: "x",
    whisperModel: "x",
    language: "en",
    speak: "all",
    mergeWindowSeconds: 0,
  },
  ui: { port: 0, open: false },
  permissions: { mode: "ask", reminderMinutes: 60, alwaysDestination: "localSettings" },
  budget: DEFAULT_BUDGET,
  sensors: DEFAULT_SENSORS,
};

/** A complete config for unit tests; each test sets only the parts it is about. */
export function testConfig(parts: Partial<AppConfig>): AppConfig {
  return { ...BASE, ...parts };
}
