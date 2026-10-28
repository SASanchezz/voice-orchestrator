import { z } from "zod";
import { budgetSchema } from "./budget-config.js";
import { cameraSchema } from "./camera-config.js";
import { editorSchema } from "./editor-config.js";
import { expandHome } from "./paths.js";
import { sensorsSchema } from "./sensor-config.js";
import { numberOr } from "./yaml-values.js";

export const PERMISSION_MODES = ["auto", "ask"] as const;
export const SPEECH_MODES = ["all", "questions", "muted"] as const;
const ALWAYS_DESTINATIONS = ["localSettings", "projectSettings", "userSettings", "session"] as const;

/** auto: workers run everything except destructive commands without asking; ask: every request goes to you. */
export type PermissionMode = (typeof PERMISSION_MODES)[number];

/** all: every notification is spoken; questions: only permission requests, short task done/failed notices and replies to your voice; muted: nothing. */
export type SpeechMode = (typeof SPEECH_MODES)[number];

const DEFAULT_RESET_MINUTES = 60;
const DEFAULT_ANSWER_WINDOW_SECONDS = 15;
const DEFAULT_UI = { port: 4777, open: true };
const DEFAULT_PERMISSIONS = { mode: "ask", reminderMinutes: 5, alwaysDestination: "localSettings" } as const;

// A key left empty in YAML reads as null; like a missing key, it gets the default.
const optionalString = z.preprocess((value) => value ?? undefined, z.string().optional());

export const projectSchema = z.object({ path: z.string(), profile: z.string(), model: optionalString });
export type ProjectConfig = z.infer<typeof projectSchema>;

const orchestratorSchema = z.object({
  profile: z.string(),
  model: optionalString,
  resetMinutes: numberOr(DEFAULT_RESET_MINUTES),
  rules: z
    .array(z.string())
    .nullish()
    .transform((rules) => rules ?? []),
  answerWindowSeconds: numberOr(DEFAULT_ANSWER_WINDOW_SECONDS),
});

const voiceSchema = z.object({
  hotkey: z.string(),
  recordBin: z.string(),
  whisperBin: z.string(),
  whisperModel: z.string().transform(expandHome),
  language: z.string(),
  sayVoice: optionalString,
  sayRate: z.preprocess((rate) => rate ?? undefined, z.number().optional()),
  speak: z
    .enum(SPEECH_MODES)
    .nullish()
    .transform((mode) => mode ?? "questions"),
});

const uiSchema = z
  .object({
    port: numberOr(DEFAULT_UI.port),
    open: z
      .boolean()
      .nullish()
      .transform((open) => open ?? DEFAULT_UI.open),
  })
  .nullish()
  .transform((ui) => ui ?? { ...DEFAULT_UI });

const permissionsSchema = z
  .object({
    mode: z
      .enum(PERMISSION_MODES)
      .nullish()
      .transform((mode) => mode ?? "ask"),
    reminderMinutes: z.number(),
    alwaysDestination: z.enum(ALWAYS_DESTINATIONS),
  })
  .nullish()
  .transform((permissions) => permissions ?? { ...DEFAULT_PERMISSIONS });

/** config/config.yaml, with defaults filled in and ~ expanded. */
export const configFileSchema = z.object({
  orchestrator: orchestratorSchema,
  profiles: z.record(z.string(), z.object({ configDir: z.string().transform(expandHome) })),
  projects: z
    .record(
      z.string(),
      projectSchema.transform((project) => ({ ...project, path: expandHome(project.path) })),
    )
    .nullish()
    .transform((projects) => projects ?? {}),
  /** Resolved absolute path, or undefined = SDK's bundled binary. */
  claudeBin: optionalString,
  searchRoots: z
    .array(z.string().nullable())
    .nullish()
    .transform((roots) => (roots ?? ["~"]).map((root) => expandHome(root ?? "~"))), // bare ~ in YAML is null
  voice: voiceSchema,
  ui: uiSchema,
  permissions: permissionsSchema,
  budget: budgetSchema,
  sensors: sensorsSchema,
  camera: cameraSchema,
  editor: editorSchema,
});

export type AppConfig = z.infer<typeof configFileSchema>;
