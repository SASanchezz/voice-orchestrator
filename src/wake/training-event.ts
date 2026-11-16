import { z } from "zod";
import { jsonLineSchema } from "../shared/json-line.js";

/** How many training recordings there are of the wake word and of other talk, and whether a model is trained. */
const samplesSchema = z.object({
  type: z.literal("samples"),
  wake: z.number().int(),
  other: z.number().int(),
  trained: z.boolean(),
});

/** The model, checked on recordings held back from its training: how many it woke on. */
const trainedSchema = z.object({
  type: z.literal("trained"),
  model: z.string(),
  caught: z.number().int(),
  checked_wake: z.number().int(),
  false_wakes: z.number().int(),
  checked_other: z.number().int(),
  /** Stretches of your quiet room, after the word in held-back recordings: none should wake it. */
  quiet_false_wakes: z.number().int(),
  checked_quiet: z.number().int(),
});

/** How sure the model was that a few seconds from the mic held the wake word, and how sure it must be to wake. */
const triedSchema = z.object({ type: z.literal("tried"), score: z.number(), threshold: z.number() });

const failedSchema = z.object({ type: z.literal("error"), message: z.string() });

export type SamplesEvent = z.infer<typeof samplesSchema>;
export type TrainedEvent = z.infer<typeof trainedSchema>;
export type TriedEvent = z.infer<typeof triedSchema>;

const trainingEventSchema = z.discriminatedUnion("type", [samplesSchema, trainedSchema, triedSchema, failedSchema]);
export type TrainingEvent = z.infer<typeof trainingEventSchema>;

const trainingLineSchema = jsonLineSchema(trainingEventSchema);

/** One line of `python -m wake samples | record | train | try` (sensors/wake). */
export function readTrainingLine(line: string): z.ZodSafeParseResult<TrainingEvent> {
  return trainingLineSchema.safeParse(line);
}
