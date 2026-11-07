import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { z } from "zod";

/** protectedBranch: the rule applies to a worker's command only when it runs on a protected branch, or one it can't tell. */
export const RULE_SCOPES = ["protectedBranch"] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export interface DestructiveRule {
  pattern: string;
  verb: string;
  tools?: string[];
  scope?: RuleScope;
}

const ruleSchema = z.object({
  pattern: z.coerce.string(),
  verb: z.coerce.string().transform((verb) => verb.toLowerCase()),
  tools: z
    .array(z.string())
    .nullish()
    .transform((tools) => tools ?? undefined),
  scope: z
    .enum(RULE_SCOPES)
    .nullish()
    .transform((scope) => scope ?? undefined),
});
const rulesFileSchema = z.object({ rules: z.array(ruleSchema).nullish() }).nullish();

const HEADER =
  "# Destructive actions. Hot-reloaded on save; also editable by voice.\n" +
  '# Approve a match by saying "confirm <verb>".\n\n';

export function readRules(path: string): DestructiveRule[] {
  return rulesFileSchema.parse(YAML.parse(readFileSync(path, "utf8")))?.rules ?? [];
}

export function writeRules(path: string, rules: DestructiveRule[]): void {
  writeFileSync(path, HEADER + YAML.stringify({ rules }, { lineWidth: 0 }));
}
