import { AccountSwitch } from "../orchestrator/actions/account-switch.js";
import { GitCommands } from "../orchestrator/actions/git-commands.js";
import { ProjectAccounts } from "../orchestrator/actions/project-accounts.js";
import { ProjectSettings } from "../config/project-settings.js";
import { ProjectOpener } from "../orchestrator/actions/project-opener.js";
import { ProjectRemover } from "../orchestrator/actions/project-remover.js";
import { ConfirmPhraseGuard } from "../orchestrator/tools/confirm-phrase-guard.js";
import { OperatorTools } from "../orchestrator/tools/operator-tools.js";
import { operatorToolList, type ToolServices } from "../orchestrator/tools/tool-catalog.js";
import { WorkSessions } from "../orchestrator/tools/work-sessions.js";
import type { SessionControl } from "../workers/session-control.js";
import { cameraView } from "./build-camera.js";
import { buildMessages } from "./build-messages.js";
import type { Core } from "./core.js";
import type { ConversationKit, OperatorDevices, OperatorNeighbors } from "./operator-types.js";

/** The operator's tools, built once; they act on the whole app. */
export function buildOperatorTools(core: Core, neighbors: OperatorNeighbors, kit: ConversationKit): OperatorTools {
  const tools = operatorToolList(toolServices(core, neighbors, kit));
  return new OperatorTools(tools, new ConfirmPhraseGuard(core.destructive, kit.context));
}

function toolServices(core: Core, neighbors: OperatorNeighbors, kit: ConversationKit): ToolServices {
  const { permissions, workers, todo, devices } = neighbors;
  return {
    ...core,
    ...workers,
    ...permissions,
    ...todo,
    ...projectActions(core, workers.control, devices.configFile),
    ...pageServices(neighbors),
    ...deviceServices(core, devices),
    git: new GitCommands(core.cfg, core.destructive, kit.context),
    workSessions: new WorkSessions(core.registry, core.sessions, workers.control),
    requests: kit.requests,
    context: kit.context,
    confirmAsk: kit.confirmAsk,
  };
}

type DeviceService = "notes" | "skills" | "screen" | "clipboard" | "cameraView" | "gestures" | "messages";

/** What the operator reads from the outside world: your notes and skills, screen, clipboard, camera and messages. */
function deviceServices(core: Core, devices: OperatorDevices): Pick<ToolServices, DeviceService> {
  return {
    notes: devices.notes,
    skills: devices.skills,
    screen: devices.screen,
    clipboard: devices.clipboard,
    cameraView: cameraView(core.cfg.camera, devices.camera),
    gestures: devices.gestures,
    messages: buildMessages(core.cfg, devices.query),
  };
}

/** The open web UI pages, and whether VS Code is there for their Code view. */
function pageServices({ editor, clients }: OperatorNeighbors): Pick<ToolServices, "editor" | "clients"> {
  return { editor: editor.server, clients };
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
