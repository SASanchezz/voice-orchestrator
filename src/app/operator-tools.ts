import { AccountSwitch } from "../orchestrator/actions/account-switch.js";
import { GitCommands } from "../orchestrator/actions/git-commands.js";
import { ProjectAccounts } from "../orchestrator/actions/project-accounts.js";
import { ProjectSettings } from "../config/project-settings.js";
import { ProjectOpener } from "../orchestrator/actions/project-opener.js";
import { ProjectRemover } from "../orchestrator/actions/project-remover.js";
import { ConfirmPhraseGuard } from "../orchestrator/tools/confirm-phrase-guard.js";
import { OperatorTools } from "../orchestrator/tools/operator-tools.js";
import { operatorToolList, type ToolServices } from "../orchestrator/tools/tool-catalog.js";
import type { SessionControl } from "../workers/session-control.js";
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
  return {
    ...core,
    ...workers,
    ...permissions,
    ...projectActions(core, workers.control, devices.configFile),
    git: new GitCommands(core.cfg, core.destructive, kit.context),
    notes: devices.notes,
    requests: kit.requests,
    context: kit.context,
    screen: devices.screen,
  };
}

/** Opening and removing projects, and moving them between accounts. */
function projectActions(
  core: Core,
  control: SessionControl,
  configFile: string,
): Pick<ToolServices, "opener" | "remover" | "accounts"> {
  const { cfg, registry } = core;
  const accounts = new AccountSwitch(cfg, control, new ProjectAccounts(core.projects, core.sessions));
  const remover = new ProjectRemover(control, registry, new ProjectSettings(cfg, configFile));
  return { opener: new ProjectOpener(cfg, registry, accounts), remover, accounts };
}
