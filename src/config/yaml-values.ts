import { z } from "zod";

/** A number, or `fallback` when the key is missing or left empty in YAML (which reads as null). */
export const numberOr = (fallback: number): z.ZodType<number, number | null | undefined> =>
  z
    .number()
    .nullish()
    .transform((value) => value ?? fallback);
