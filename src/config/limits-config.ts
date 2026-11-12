import { z } from "zod";
import { numberOr } from "./yaml-values.js";

/** How tasks saved to todo by a usage limit are resumed once the limit resets. */
export const DEFAULT_LIMITS = {
  /** Resume saved tasks on their own once their account's limit resets. */
  autoResume: true,
  /** How often the saved tasks are checked. */
  checkMinutes: 5,
  /** Minutes to wait after the reset time, so the account is surely back. */
  graceMinutes: 3,
  /** Minutes to wait when the error named no reset time. */
  unknownResetMinutes: 60,
  /** Older saved tasks wait for you instead: you may have moved on from them. */
  maxAgeHours: 24,
};

export const limitsSchema = z
  .object({
    autoResume: z
      .boolean()
      .nullish()
      .transform((autoResume) => autoResume ?? DEFAULT_LIMITS.autoResume),
    checkMinutes: numberOr(DEFAULT_LIMITS.checkMinutes),
    graceMinutes: numberOr(DEFAULT_LIMITS.graceMinutes),
    unknownResetMinutes: numberOr(DEFAULT_LIMITS.unknownResetMinutes),
    maxAgeHours: numberOr(DEFAULT_LIMITS.maxAgeHours),
  })
  .nullish()
  .transform((limits) => limits ?? { ...DEFAULT_LIMITS });
export type LimitsConfig = z.infer<typeof limitsSchema>;
