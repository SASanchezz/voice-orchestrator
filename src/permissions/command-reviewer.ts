import { z } from "zod";
import type { AppConfig } from "../config/app-config.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import type { QuickModel } from "../workers/quick-model.js";
import type { ToolCall } from "./permission-types.js";

const verdictSchema = z.object({ allow: z.boolean(), reason: z.string() });
export type ReviewVerdict = z.infer<typeof verdictSchema>;

/** The model may wrap its JSON in a code fence or a sentence; the object itself is what counts. */
const JSON_OBJECT = /\{[\s\S]*\}/;

const GUIDANCE =
  "Allow it when it is routine development work whose effects stay on this machine and can be redone or " +
  "regenerated: deleting build output, caches, node_modules, temp or scratch files; local git housekeeping that " +
  "keeps every commit and uncommitted change; editing or reading files the task plausibly needs; downloading a " +
  "published tool from its official release page or package registry into a temp or project folder and running " +
  "it on local files. " +
  "Destructive rules are plain word matches: when the matched word only appears in text the command writes, " +
  "prints or edits (a document, a string in a script), judge the call by what it actually does. " +
  "Send it to the user when it could lose work that can't be recovered (uncommitted changes, files outside " +
  "the project, other people's data), reaches anything shared or remote (pushing, deploying, publishing, " +
  "databases, cloud resources, sending messages), changes system settings or credentials, sends a secret off " +
  "this machine, installs software system-wide, pipes a download straight into a shell, runs code from an " +
  "unknown source, or when you are not sure.\n\n";

/**
 * Reads a worker's tool call the policy wouldn't pass on its own and decides whether it is routine enough to run
 * without you. When in doubt it sends the call to you; it never denies one.
 */
export class CommandReviewer {
  constructor(
    private cfg: AppConfig,
    private model: QuickModel,
  ) {}

  async review(project: string, call: ToolCall, rule: DestructiveRule | undefined): Promise<ReviewVerdict> {
    const prompt = CommandReviewer.promptFor(this.cfg.projects[project].path, call, rule);
    return CommandReviewer.verdictIn(await this.model.ask(project, prompt, "review"));
  }

  private static verdictIn(answer: string): ReviewVerdict {
    const json = JSON_OBJECT.exec(answer);
    if (!json) throw new Error(`review answer has no verdict: ${answer}`);
    return verdictSchema.parse(JSON.parse(json[0]));
  }

  private static promptFor(folder: string, call: ToolCall, rule: DestructiveRule | undefined): string {
    const flagged = rule ? `it matches the destructive rule "${rule.verb}"` : "it is not on the list of safe calls";
    return (
      `You approve tool calls for a coding assistant working in the folder ${folder}; the user has handed routine ` +
      `approvals to you. This call needs approval because ${flagged}:\n\n` +
      `Tool: ${call.toolName}\nInput: ${JSON.stringify(call.input)}\n\n` +
      GUIDANCE +
      'Reply with only JSON: {"allow": true or false, "reason": "<under 15 words>"}'
    );
  }
}
