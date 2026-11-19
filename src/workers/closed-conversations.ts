import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AppConfig } from "../config/app-config.js";
import type { Projects } from "../registry/projects.js";
import type { Sessions } from "../registry/sessions.js";
import { HEADLESS_NOTE } from "./task-launcher.js";
import { readTranscriptHead } from "./transcript-head.js";

/** How many of the latest transcripts are opened to find the closed sessions among them. */
const SCANNED_COUNT = 50;
const LISTED_COUNT = 10;
/** An untitled conversation is named by the start of its first prompt. */
const UNTITLED_NAME_LENGTH = 80;
const TRANSCRIPT_EXTENSION = ".jsonl";

/** A worker conversation Claude Code still keeps after its session was closed here. */
export interface ClosedConversation {
  claudeSessionId: string;
  title: string;
  lastActive: Date;
  /** Claude Code's saved conversation, which also holds the session's chat. */
  transcriptFile: string;
}

interface SavedTranscript {
  file: string;
  modifiedAt: Date;
}

/** Finds a project's closed sessions in Claude Code's saved conversations, which closing a session leaves behind. */
export class ClosedConversations {
  constructor(
    private cfg: AppConfig,
    private projects: Projects,
    private sessions: Sessions,
  ) {}

  /** The project's worker conversations that no open session continues, latest first. */
  async list(project: string): Promise<ClosedConversation[]> {
    const open = new Set(this.sessions.sessionsOf(project).map((session) => session.claudeSessionId));
    const transcripts = await ClosedConversations.latestTranscripts(this.transcriptFolder(project));
    const unopened = transcripts.filter((transcript) => !open.has(ClosedConversations.idOf(transcript.file)));
    const conversations = await Promise.all(
      unopened.map((transcript) => ClosedConversations.workerConversation(transcript)),
    );
    return conversations.filter((conversation) => conversation !== undefined).slice(0, LISTED_COUNT);
  }

  /** One of the listed closed sessions; an error when it isn't among them, such as one reopened since. */
  async find(project: string, claudeSessionId: string): Promise<ClosedConversation> {
    const conversation = (await this.list(project)).find((closed) => closed.claudeSessionId === claudeSessionId);
    if (!conversation) throw new Error(`${project} has no closed session ${claudeSessionId} to reopen.`);
    return conversation;
  }

  /** Claude Code keeps a folder's conversations under its account, named after the folder's path. */
  private transcriptFolder(project: string): string {
    const { configDir } = this.cfg.profiles[this.projects.get(project).profile];
    const folderKey = this.cfg.projects[project].path.replace(/[^a-zA-Z0-9]/g, "-");
    return join(configDir, "projects", folderKey);
  }

  private static async latestTranscripts(folder: string): Promise<SavedTranscript[]> {
    const names = await ClosedConversations.transcriptNames(folder);
    const transcripts = await Promise.all(names.map((name) => ClosedConversations.saved(join(folder, name))));
    return transcripts.toSorted((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()).slice(0, SCANNED_COUNT);
  }

  /** A folder Claude Code never ran in has no transcripts folder yet. */
  private static async transcriptNames(folder: string): Promise<string[]> {
    const names = await readdir(folder).catch(() => []);
    return names.filter((name) => name.endsWith(TRANSCRIPT_EXTENSION));
  }

  private static async saved(file: string): Promise<SavedTranscript> {
    return { file, modifiedAt: (await stat(file)).mtime };
  }

  private static idOf(file: string): string {
    return basename(file, TRANSCRIPT_EXTENSION);
  }

  /** Undefined for conversations this app's workers didn't start, such as VS Code sessions or a project's own SDK calls. */
  private static async workerConversation(transcript: SavedTranscript): Promise<ClosedConversation | undefined> {
    const { firstPrompt, title } = await readTranscriptHead(transcript.file);
    if (!firstPrompt.includes(HEADLESS_NOTE.trim())) return undefined;
    const claudeSessionId = ClosedConversations.idOf(transcript.file);
    return {
      claudeSessionId,
      title: title ?? firstPrompt.slice(0, UNTITLED_NAME_LENGTH),
      lastActive: transcript.modifiedAt,
      transcriptFile: transcript.file,
    };
  }
}
