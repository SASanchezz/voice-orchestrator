import { isRecord } from "../shared/records.js";
import { asText } from "../shared/text.js";

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

/** A hook's tool input as a record; anything else (or nothing) reads as empty. */
export function toolInput(input: unknown): Record<string, unknown> {
  return isRecord(input) ? input : {};
}

/** Text a rule is matched against for a given tool call. */
export function describeToolCall(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash") return asText(input.command ?? "");
  const target = input.file_path ?? input.path ?? input.notebook_path ?? input.url;
  return target ? `${toolName} ${asText(target)}` : `${toolName} ${JSON.stringify(input)}`;
}
