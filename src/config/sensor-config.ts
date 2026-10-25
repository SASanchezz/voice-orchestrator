import { resolve } from "node:path";
import { z } from "zod";
import { APP_DIR, expandHome } from "./paths.js";

/** The camera gesture sensor in sensors/gestures; off until you set it up and turn it on. */
const DEFAULT_GESTURES = {
  enabled: false,
  python: "sensors/gestures/.venv/bin/python",
  args: ["-m", "gestures", "run"],
  mapping: "config/gestures.yaml",
};

// A key left empty in YAML reads as null; like a missing key, it gets the default.
const missingAsUndefined = (value: unknown): unknown => value ?? undefined;
const missingAsEmpty = (value: unknown): unknown => value ?? {};

/** A path relative to the app's folder, or absolute, or starting with ~. */
const appPathOr = (fallback: string): z.ZodType<string> =>
  z.preprocess(missingAsUndefined, z.string().default(fallback)).transform(appPath);

const gesturesSchema = z.preprocess(
  missingAsEmpty,
  z.object({
    enabled: z.preprocess(missingAsUndefined, z.boolean().default(DEFAULT_GESTURES.enabled)),
    python: appPathOr(DEFAULT_GESTURES.python),
    /** What follows the interpreter, e.g. extra `--min-hold-ms 400` to tune the sensor. */
    args: z.preprocess(missingAsUndefined, z.array(z.string()).default(DEFAULT_GESTURES.args)),
    /** Which gesture does what, see config/gestures.example.yaml. */
    mapping: appPathOr(DEFAULT_GESTURES.mapping),
  }),
);
export type GestureSettings = z.infer<typeof gesturesSchema>;

export const sensorsSchema = z.preprocess(missingAsEmpty, z.object({ gestures: gesturesSchema }));
export type SensorsConfig = z.infer<typeof sensorsSchema>;

/** What a config file without a `sensors` section gets. */
export const DEFAULT_SENSORS: SensorsConfig = sensorsSchema.parse(undefined);

function appPath(path: string): string {
  return resolve(APP_DIR, expandHome(path));
}
