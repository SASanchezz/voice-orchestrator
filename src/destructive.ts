import { readFileSync, writeFileSync, watchFile } from "node:fs";
import YAML from "yaml";
import { DESTRUCTIVE_PATH } from "./config.js";

export interface DestructiveRule {
  pattern: string;
  verb: string;
  tools?: string[];
}

/**
 * Strip git's global options so "git -C repo -c user.name=x commit" is seen as "git commit".
 * Keeps the rules in destructive.yaml simple (\bgit\s+commit\b) without missing real-world forms.
 */
export function normalizeCommand(cmd: string): string {
  return cmd.replace(
    /\bgit((\s+(-[cC]|--git-dir|--work-tree|--namespace|--exec-path|--config-env)(=|\s+)("[^"]*"|'[^']*'|\S+))|(\s+(--no-pager|--bare|--paginate|--no-replace-objects|--literal-pathspecs|--no-optional-locks|-p|-P)))+(?=\s)/g,
    "git",
  );
}

/** Text a rule is matched against for a given tool call. */
export function describeToolCall(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash") return String(input.command ?? "");
  const target = input.file_path ?? input.path ?? input.notebook_path ?? input.url;
  return target ? `${toolName} ${String(target)}` : `${toolName} ${JSON.stringify(input)}`;
}

/** Normalize a transcript: lowercase, letters/digits/spaces only. */
export const normalizeSpeech = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** True when the user literally said "confirm <verb>" in this utterance. */
export function utteranceConfirms(utterance: string | undefined, verb: string): boolean {
  if (!utterance) return false;
  return ` ${normalizeSpeech(utterance)} `.includes(` confirm ${normalizeSpeech(verb)} `);
}

export class DestructiveList {
  private rules: DestructiveRule[] = [];
  private compiled: { rule: DestructiveRule; re: RegExp }[] = [];

  constructor(private path = DESTRUCTIVE_PATH, watch = true) {
    this.reload();
    if (watch) watchFile(this.path, { interval: 1000 }, () => this.reload());
  }

  reload() {
    try {
      const doc = YAML.parse(readFileSync(this.path, "utf8")) ?? {};
      const rules: DestructiveRule[] = (doc.rules ?? []).map((r: DestructiveRule) => ({
        pattern: String(r.pattern),
        verb: String(r.verb).toLowerCase(),
        tools: r.tools,
      }));
      const compiled = rules.map((rule) => ({ rule, re: new RegExp(rule.pattern, "i") }));
      this.rules = rules;
      this.compiled = compiled;
    } catch (e) {
      // Keep the previous list if the file is mid-edit or invalid.
      console.error(`[destructive] reload failed, keeping previous rules: ${(e as Error).message}`);
    }
  }

  list(): DestructiveRule[] {
    return [...this.rules];
  }

  match(toolName: string, input: Record<string, unknown>): DestructiveRule | undefined {
    return this.matchText(describeToolCall(toolName, input), toolName);
  }

  matchText(text: string, toolName = "Bash"): DestructiveRule | undefined {
    const candidates = toolName === "Bash" ? [text, normalizeCommand(text)] : [text];
    return this.compiled.find(
      ({ rule, re }) => (rule.tools ?? ["Bash"]).includes(toolName) && candidates.some((t) => re.test(t)),
    )?.rule;
  }

  add(rule: DestructiveRule) {
    new RegExp(rule.pattern, "i"); // throws on invalid regex
    this.save([...this.rules.filter((r) => r.pattern !== rule.pattern), rule]);
  }

  remove(pattern: string): boolean {
    const next = this.rules.filter((r) => r.pattern !== pattern);
    if (next.length === this.rules.length) return false;
    this.save(next);
    return true;
  }

  private save(rules: DestructiveRule[]) {
    const header =
      "# Destructive actions. Hot-reloaded on save; also editable by voice.\n" +
      "# Approve a match by saying \"confirm <verb>\".\n\n";
    writeFileSync(this.path, header + YAML.stringify({ rules }, { lineWidth: 0 }));
    this.reload();
  }
}
