import { z } from "zod";

/** One line of a child process's stdout: JSON, checked against `schema`. */
export function jsonLineSchema<Output>(schema: z.ZodType<Output>): z.ZodType<Output, string> {
  return z
    .string()
    .transform((line, context): unknown => {
      try {
        return JSON.parse(line);
      } catch {
        context.addIssue({ code: "custom", message: "not JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);
}
