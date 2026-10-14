import type { ProjectSettings } from "../../config/project-settings.js";
import type { Registry } from "../../registry/registry.js";
import type { SessionControl } from "../../workers/session-control.js";

/**
 * Unregisters a project: stops its workers, forgets its sessions with their queues, chats and history,
 * and takes it out of the config. Its folder on disk is never touched.
 */
export class ProjectRemover {
  constructor(
    private control: SessionControl,
    private registry: Registry,
    private settings: ProjectSettings,
  ) {}

  /** Whether removing it would stop a running task. */
  isBusy(project: string): boolean {
    return this.control.isBusy(project);
  }

  async remove(project: string): Promise<string> {
    await this.control.stopProjectAndWait(project);
    this.registry.removeProject(project);
    this.settings.forget(project);
    return `Removed ${project}: its workers are stopped and its sessions, queues and history are deleted. Its folder is untouched.`;
  }
}
