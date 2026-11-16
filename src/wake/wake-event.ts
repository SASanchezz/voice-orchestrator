import { z } from "zod";
import { jsonLineSchema } from "../shared/json-line.js";

/**
 * One line of the wake listener's stdout (sensors/wake). wake: the wake word was heard, with how sure it is (0..1);
 * speech_end: you went quiet after speaking; stop_word: you said the wake word again to end your message;
 * no_speech: you said nothing after it.
 */
const wakeEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), model: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("wake"), score: z.number() }),
  z.object({ type: z.literal("speech_end") }),
  z.object({ type: z.literal("stop_word") }),
  z.object({ type: z.literal("no_speech") }),
]);
export type WakeEvent = z.infer<typeof wakeEventSchema>;

const wakeLineSchema = jsonLineSchema(wakeEventSchema);

export function readWakeLine(line: string): z.ZodSafeParseResult<WakeEvent> {
  return wakeLineSchema.safeParse(line);
}
