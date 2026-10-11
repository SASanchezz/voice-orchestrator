import { AccountSwitch } from "../orchestrator/actions/account-switch.js";
import { GitCommands } from "../orchestrator/actions/git-commands.js";
import { ProjectAccounts } from "../orchestrator/actions/project-accounts.js";
import { ProjectOpener } from "../orchestrator/actions/project-opener.js";
import { ConfirmPhraseGuard } from "../orchestrator/tools/confirm-phrase-guard.js";
import { OperatorTools } from "../orchestrator/tools/operator-tools.js";
import { operatorToolList, type ToolServices } from "../orchestrator/tools/tool-catalog.js";
import type { Core } from "./core.js";
import type { ConversationKit, OperatorNeighbors } from "./operator-types.js";

/** The operator's tools, built once; they act on the whole app. */
export function buildOperatorTools(core: Core, neighbors: OperatorNeighbors, kit: ConversationKit): OperatorTools {
  const tools = operatorToolList(toolServices(core, neighbors, kit));
  return new OperatorTools(tools, new ConfirmPhraseGuard(core.destructive, kit.context));
}

function toolServices(
  core: Core,
  { permissions, workers, devices }: OperatorNeighbors,
  kit: ConversationKit,
): ToolServices {
  const { cfg, registry, destructive } = core;
  const accounts = new AccountSwitch(cfg, workers.control, new ProjectAccounts(core.projects, core.sessions));
  return {
    ...core,
    ...workers,
    ...permissions,
    opener: new ProjectOpener(cfg, registry, accounts),
    accounts,
    git: new GitCommands(cfg, destructive, kit.context),
    notes: devices.notes,
    requests: kit.requests,
    context: kit.context,
    screen: devices.screen,
  };
}
