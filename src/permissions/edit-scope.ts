import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { namesSecretFile } from "../safety/secret-files.js";
import { asText } from "../shared/text.js";
import type { ToolCall } from "./permission-types.js";

/** Claude Code's own tools that change a file. */
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const PARENT_FOLDER = "..";

/** The folder a session's worker runs in. */
export type SessionFolder = (sessionId: string) => string;

export function isFileEdit(toolName: string): boolean {
  return EDIT_TOOLS.has(toolName);
}

/**
 * Where a session's worker may change files without asking: anywhere in its project's folder, and in each folder
 * outside it that you allowed an edit in, with everything inside that folder. A file that holds secrets always asks.
 */
export class EditScope {
  private allowedFolders = new Map<string, string[]>();

  constructor(private folderOf: SessionFolder) {}

  allows(sessionId: string, call: ToolCall): boolean {
    if (!isFileEdit(call.toolName)) return false;
    const file = this.editedFile(sessionId, call);
    if (namesSecretFile(file)) return false;
    return this.foldersOf(sessionId).some((folder) => EditScope.isInside(file, folder));
  }

  /** You allowed this edit: the session may change anything in the edited file's folder from now on. */
  allowFolderOf(sessionId: string, call: ToolCall): void {
    if (!isFileEdit(call.toolName) || this.allows(sessionId, call)) return;
    const folder = dirname(this.editedFile(sessionId, call));
    this.allowedFolders.set(sessionId, [...(this.allowedFolders.get(sessionId) ?? []), folder]);
  }

  private foldersOf(sessionId: string): string[] {
    return [this.folderOf(sessionId), ...(this.allowedFolders.get(sessionId) ?? [])];
  }

  private editedFile(sessionId: string, call: ToolCall): string {
    const path = asText(call.input.file_path ?? call.input.notebook_path ?? "");
    return resolve(this.folderOf(sessionId), path);
  }

  private static isInside(file: string, folder: string): boolean {
    const path = relative(folder, file);
    return !isAbsolute(path) && path.split(sep)[0] !== PARENT_FOLDER;
  }
}
