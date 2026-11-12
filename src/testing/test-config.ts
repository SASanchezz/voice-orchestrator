import { DEFAULT_PROTECTED_BRANCHES, type AppConfig } from "../config/app-config.js";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import { DEFAULT_LIMITS } from "../config/limits-config.js";
import { DEFAULT_CAMERA } from "../config/camera-config.js";
import { DEFAULT_EDITOR_SETTINGS } from "../config/editor-config.js";
import { DEFAULT_MESSAGES } from "../config/messages-config.js";
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
    engine: "say",
    kokoroVoice: "af_heart",
    kokoroSpeed: 1,
    speak: "all",
  },
  ui: { port: 0, open: false },
  permissions: {
    mode: "ask",
    reminderMinutes: 60,
    alwaysDestination: "localSettings",
    protectedBranches: DEFAULT_PROTECTED_BRANCHES,
  },
  budget: DEFAULT_BUDGET,
  limits: DEFAULT_LIMITS,
  sensors: DEFAULT_SENSORS,
  camera: DEFAULT_CAMERA,
  editor: DEFAULT_EDITOR_SETTINGS,
  messages: DEFAULT_MESSAGES,
};

/** A complete config for unit tests; each test sets only the parts it is about. */
export function testConfig(parts: Partial<AppConfig>): AppConfig {
  return { ...BASE, ...parts };
}
