import { watchFile } from "node:fs";
import { DESTRUCTIVE_PATH } from "../config/paths.js";
import { errorMessage } from "../shared/errors.js";
import { readRules, writeRules, type DestructiveRule } from "./destructive-rules-file.js";
import { describeToolCall, normalizeCommand } from "./tool-calls.js";

const WATCH_INTERVAL_MS = 1000;

interface CompiledRule {
  rule: DestructiveRule;
  re: RegExp;
}

/** The rules in config/destructive.yaml: tool calls that need the user to say "confirm <verb>". */
export class DestructiveList {
  private compiled: CompiledRule[] = [];

  constructor(private path = DESTRUCTIVE_PATH) {
    this.reload();
  }

  /** Picks up edits to the file as soon as it is saved. */
  watchForChanges(): void {
    watchFile(this.path, { interval: WATCH_INTERVAL_MS }, () => this.reload());
  }

  reload(): void {
    try {
      this.compiled = readRules(this.path).map(compile);
    } catch (e) {
      // Keep the previous list if the file is mid-edit or invalid.
      console.error(`[destructive] reload failed, keeping previous rules: ${errorMessage(e)}`);
    }
  }

  list(): DestructiveRule[] {
    return this.compiled.map(({ rule }) => rule);
  }

  match(toolName: string, input: Record<string, unknown>): DestructiveRule | undefined {
    return this.matchText(describeToolCall(toolName, input), toolName);
  }

  matchText(text: string, toolName = "Bash"): DestructiveRule | undefined {
    return findRule(this.compiled, text, toolName)?.rule;
  }

  /** Throws on an invalid regex, before anything is saved. */
  add(rule: DestructiveRule): void {
    this.save([...this.list().filter((r) => r.pattern !== rule.pattern), compile(rule).rule]);
  }

  remove(pattern: string): boolean {
    const rules = this.list();
    const next = rules.filter((r) => r.pattern !== pattern);
    if (next.length === rules.length) return false;
    this.save(next);
    return true;
  }

  private save(rules: DestructiveRule[]): void {
    writeRules(this.path, rules);
    this.reload();
  }
}

function compile(rule: DestructiveRule): CompiledRule {
  return { rule, re: new RegExp(rule.pattern, "i") };
}

function findRule(compiled: CompiledRule[], text: string, toolName: string): CompiledRule | undefined {
  const candidates = toolName === "Bash" ? [text, normalizeCommand(text)] : [text];
  return compiled.find(
    ({ rule, re }) => (rule.tools ?? ["Bash"]).includes(toolName) && candidates.some((t) => re.test(t)),
  );
}
