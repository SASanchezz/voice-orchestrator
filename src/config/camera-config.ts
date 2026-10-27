import { z } from "zod";

export const DESCRIBERS = ["claude", "local"] as const;

/** claude: Claude sees the camera frame; local: a local vision model describes it and only its text reaches Claude. */
export type Describer = (typeof DESCRIBERS)[number];

/** llama-server's default address. */
const DEFAULT_VISION_SERVER = "http://127.0.0.1:8080";

// A key left empty in YAML reads as null; like a missing key, it gets the default.
const missingAsUndefined = (value: unknown): unknown => value ?? undefined;
const missingAsEmpty = (value: unknown): unknown => value ?? {};

export const cameraSchema = z.preprocess(
  missingAsEmpty,
  z.object({
    describer: z.preprocess(missingAsUndefined, z.enum(DESCRIBERS).default("claude")),
    /** An OpenAI-compatible server with a vision model, e.g. llama-server; used with `describer: local`. */
    visionServer: z.preprocess(missingAsUndefined, z.url().default(DEFAULT_VISION_SERVER)),
  }),
);
export type CameraSettings = z.infer<typeof cameraSchema>;

/** What a config file without a `camera` section gets. */
export const DEFAULT_CAMERA: CameraSettings = cameraSchema.parse(undefined);
