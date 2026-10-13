import { z } from "zod";

/** The tool a worker uses to ask you a question with proposed answers, the dialog Claude Code shows in its own session. */
export const QUESTION_TOOL = "AskUserQuestion";

const optionSchema = z.object({
  label: z.string().min(1),
  /** What picking it means; shown on screen, never read aloud. */
  description: z.string().default(""),
});

const questionSchema = z.object({
  question: z.string().min(1),
  /** A short chip such as "Database". */
  header: z.string().default(""),
  options: z.array(optionSchema).min(1),
  /** True when several options may be picked. */
  multiSelect: z.boolean().default(false),
});

/** The tool's input as the worker sends it; a free-text answer is always allowed, as in Claude Code. */
export const questionInputSchema = z.object({ questions: z.array(questionSchema).min(1) });

export type WorkerQuestion = z.infer<typeof questionSchema>;
