import type { Orchestrator } from "../../orchestrator/orchestrator.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { UiState } from "../protocol.js";
import type { UiLookup } from "./ui-lookup.js";

/** Everything the page shows that can change at any moment. */
export class UiStateView {
  constructor(
    private lookup: UiLookup,
    private permissions: PermissionViews,
    private orchestrator: Orchestrator,
  ) {}

  state(): UiState {
    return {
      projects: this.lookup.projectViews(),
      pending: this.permissions.requests(),
      permissionMode: this.permissions.permissionMode,
      speechMode: this.orchestrator.speechMode,
      voiceInput: this.orchestrator.voiceInput,
    };
  }
}
