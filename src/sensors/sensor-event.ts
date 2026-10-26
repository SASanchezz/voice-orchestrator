import { z } from "zod";

/** start/end: a gesture held, like key down and up. tap: a one-shot gesture such as a swipe. */
const gestureEventSchema = z.object({
  type: z.literal("gesture"),
  phase: z.enum(["start", "end", "tap"]),
  name: z.string(),
  hand: z.string(),
  confidence: z.number().optional(),
  heldMs: z.number().optional(),
  ts: z.number(),
});
export type GestureEvent = z.infer<typeof gestureEventSchema>;

/** The answer to a `snapshot` command: the JPEG is written to its path, or why it isn't. */
const snapshotAnswerSchema = z.discriminatedUnion("ok", [
  z.object({ type: z.literal("snapshot"), id: z.string(), ok: z.literal(true), path: z.string() }),
  z.object({ type: z.literal("snapshot"), id: z.string(), ok: z.literal(false), message: z.string() }),
]);
export type SnapshotAnswer = z.infer<typeof snapshotAnswerSchema>;

/** One line of a sensor's stdout, see the event protocol in docs/gestures-plan.md. */
const sensorEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), recognizer: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  gestureEventSchema,
  snapshotAnswerSchema,
]);
export type SensorEvent = z.infer<typeof sensorEventSchema>;

const sensorLineSchema = z
  .string()
  .transform((line, context): unknown => {
    try {
      return JSON.parse(line);
    } catch {
      context.addIssue({ code: "custom", message: "not JSON" });
      return z.NEVER;
    }
  })
  .pipe(sensorEventSchema);

export function readSensorLine(line: string): z.ZodSafeParseResult<SensorEvent> {
  return sensorLineSchema.safeParse(line);
}
