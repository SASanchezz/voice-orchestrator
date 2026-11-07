import { errorMessage } from "../shared/errors.js";
import { findNamed } from "./chat-names.js";
import type { CatchUpRequest, MessageReading } from "./message-reading.js";
import type { MessageSource, SourceKind } from "./message-types.js";
import type { SourceCatchUp } from "./source-catch-up.js";

export const READING_OFF =
  "Reading messages is off: config/config.yaml has no messages block (config/config.example.yaml shows one).";
const KIND_NAMES: Record<SourceKind, string> = { slack: "Slack", telegram: "Telegram" };

/** Picks the sources asked for and catches up on each in turn; one failing source doesn't stop the rest. */
export class MessageCatchUp implements MessageReading {
  constructor(
    private sources: MessageSource[],
    private sourceCatchUp: SourceCatchUp,
  ) {}

  async catchUp(request: CatchUpRequest): Promise<string> {
    const lines: string[] = [];
    for (const source of this.chosen(request)) lines.push(await this.catchUpOrReport(source, request.chat));
    return lines.join("\n");
  }

  sourceList(): string {
    if (!this.sources.length) return READING_OFF;
    return this.sources.map((source) => `- ${source.describe()}`).join("\n");
  }

  private chosen({ source, workspace }: CatchUpRequest): MessageSource[] {
    if (!this.sources.length) throw new Error(READING_OFF);
    const ofKind = source ? this.sources.filter((candidate) => candidate.kind === source) : this.sources;
    if (source && !ofKind.length) throw new Error(`${KIND_NAMES[source]} isn't set up under messages in config.yaml.`);
    return workspace ? [this.workspaceNamed(workspace)] : ofKind;
  }

  private workspaceNamed(spoken: string): MessageSource {
    const workspaces = this.sources.filter((source) => source.kind === "slack");
    const found = findNamed(workspaces, spoken, (source) => source.name);
    if (found) return found;
    const known = workspaces.map((source) => source.name).join(", ") || "none";
    throw new Error(`No Slack workspace like "${spoken}". Set up: ${known}.`);
  }

  private async catchUpOrReport(source: MessageSource, chat: string | undefined): Promise<string> {
    try {
      return await this.sourceCatchUp.catchUpOn(source, chat);
    } catch (error) {
      return `${source.name}: couldn't read it: ${errorMessage(error)}`;
    }
  }
}
