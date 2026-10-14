// What a tool call does, for the permission policy: only read, or read a secret.

import { asText } from "../shared/text.js";
import { commandReadsSecrets } from "./command-secrets.js";
import { isReadOnlyCommand } from "./read-only-commands.js";
import { namesSecretFile } from "./secret-files.js";

/** Claude Code's own tools that only read files or list them. */
const READ_ONLY_TOOLS = new Set(["Read", "Grep", "Glob", "LS", "NotebookRead"]);
/** Of those, the ones that read what is in a file. */
const CONTENT_TOOLS = new Set(["Read", "Grep", "NotebookRead"]);

export function isReadOnlyCall(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName === "Bash") return isReadOnlyCommand(asText(input.command ?? ""));
  return READ_ONLY_TOOLS.has(toolName);
}

/** Reads a file with keys, credentials, tokens or a .env in it; such a call always asks you. */
export function readsSecrets(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName === "Bash") return commandReadsSecrets(asText(input.command ?? ""));
  if (!CONTENT_TOOLS.has(toolName)) return false;
  return namesSecretFile(asText(input.file_path ?? input.path ?? input.notebook_path ?? ""));
}
