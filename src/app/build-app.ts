import type { AppConfig } from "../config/app-config.js";
import { CommandExplainer } from "../permissions/command-explainer.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import { PermissionPopups, type PopupDevice } from "../ui/permission-popups.js";
import { buildOperator, type OperatorParts } from "./build-operator.js";
import { buildPermissions, type PermissionParts } from "./build-permissions.js";
import { buildUi, type UiParts } from "./build-ui.js";
import { buildWorkers, type WorkerParts } from "./build-workers.js";
import { buildCore, type Core } from "./core.js";
import type { OperatorDevices } from "./operator-types.js";

/** The app's ties to the outside world; tests pass fakes. */
export interface Adapters extends OperatorDevices {
  destructive: DestructiveList;
  /** Explain each permission request in plain words on its card and pop-up (one extra model call each). */
  explainCommands: boolean;
  /** Native pop-ups for permission requests. */
  popups: PopupDevice;
}

export interface App {
  core: Core;
  permissions: PermissionParts;
  workers: WorkerParts;
  operator: OperatorParts;
  ui: UiParts;
}

/** Builds everything; the operator listens to events before the timeline and the chats do. */
export function buildApp(cfg: AppConfig, adapters: Adapters): App {
  const core = buildCore(cfg, adapters.destructive);
  const explainer = new CommandExplainer(cfg, core.projects, adapters.query);
  const explain = adapters.explainCommands
    ? (project: string, command: string) => explainer.explain(project, command)
    : undefined;
  const permissions = buildPermissions(core, explain);
  const workers = buildWorkers(core, permissions.broker, adapters.query);
  const neighbors = { permissions, workers, devices: adapters };
  const operator = buildOperator(core, neighbors);
  const ui = buildUi(core, neighbors, operator);
  new PermissionPopups(adapters.popups, ui.permissionClicks).follow(core.events);
  return { core, permissions, workers, operator, ui };
}

/** The operator's model session starts, then it listens for your voice. */
export async function startOperator(app: App, voice: OperatorDevices["voice"]): Promise<void> {
  app.operator.session.start();
  await voice.start();
}
