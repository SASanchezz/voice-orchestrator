import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig } from "../../config/app-config.js";
import { utteranceConfirms } from "../../safety/confirm-phrase.js";
import type { DestructiveList } from "../../safety/destructive-list.js";
import type { TurnContext } from "../conversation/turn-context.js";

const run = promisify(execFile);

const MAX_BUFFER_BYTES = 1_048_576; // 1 MiB
const MAX_OUTPUT_CHARS = 1500;

/** Simple git commands run directly in a project (e.g. "move to stage" = git add -A); destructive ones need the confirm phrase. */
export class GitCommands {
  constructor(
    private cfg: AppConfig,
    private destructive: DestructiveList,
    private context: TurnContext,
  ) {}

  async run(project: string, args: string): Promise<string> {
    const argv = splitArgs(args);
    const rule = this.destructive.matchText(`git ${argv.join(" ")}`);
    if (rule && !utteranceConfirms(this.context.currentUtterance, rule.verb))
      return `Destructive (${rule.verb}). Not run. Ask the user to say "confirm ${rule.verb}".`;
    const options = { cwd: this.cfg.projects[project].path, maxBuffer: MAX_BUFFER_BYTES };
    const { stdout, stderr } = await run("git", argv, options);
    return (stdout + stderr).trim().slice(0, MAX_OUTPUT_CHARS) || "Done, no output.";
  }
}

/** "commit -m 'a b'" -> ["commit", "-m", "a b"]; a leading "git" is dropped. */
function splitArgs(args: string): string[] {
  const argv = args.match(/"[^"]*"|'[^']*'|\S+/g)?.map((a) => a.replace(/^["']|["']$/g, "")) ?? [];
  return argv[0] === "git" ? argv.slice(1) : argv;
}
