import { existsSync, readFileSync } from "node:fs";
import YAML from "yaml";
import { z } from "zod";

/** Actions that last as long as the gesture is held. */
export const HOLD_ACTIONS = ["talk"] as const;
/** Actions done once, the moment the gesture is recognized. */
export const TAP_ACTIONS = [
  "start_talk",
  "end_talk",
  "discard",
  "stop_speaking",
  "repeat_last",
  "space_left",
  "space_right",
] as const;
export type TapAction = (typeof TAP_ACTIONS)[number];

const tapActionSchema = z.enum(TAP_ACTIONS);

/** `tap` is one action or a list, done in order; either way it is read as a list. */
const tapActionsSchema = z.union([
  tapActionSchema.transform((action) => [action]),
  z.array(tapActionSchema).nonempty(),
]);

const reflexSchema = z.union([
  z.strictObject({ hold: z.enum(HOLD_ACTIONS) }),
  z.strictObject({ tap: tapActionsSchema }),
]);
export type Reflex = z.infer<typeof reflexSchema>;

/** Gesture name -> what it does, straight away and without a model turn. */
export type ReflexTable = ReadonlyMap<string, Reflex>;

const reflexFileSchema = z.record(z.string(), reflexSchema);

/** config/gestures.yaml; a gesture it doesn't name does nothing. */
export function loadReflexTable(path: string): ReflexTable {
  if (!existsSync(path))
    throw new Error(`${path} not found. Copy config/gestures.example.yaml to it, or turn sensors.gestures off.`);
  const reflexes = reflexFileSchema.parse(YAML.parse(readFileSync(path, "utf8")));
  return new Map(Object.entries(reflexes));
}
