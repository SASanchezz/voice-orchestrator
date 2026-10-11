import type { ProjectPatch, ProjectState } from "./registry-schema.js";

/** The projects you can talk to, each on one account. */
export class Projects {
  constructor(
    private byName: Map<string, ProjectState>,
    private save: () => void,
  ) {}

  get(name: string): ProjectState {
    const project = this.byName.get(name);
    if (!project) throw new Error(`unknown project "${name}"`);
    return project;
  }

  all(): ProjectState[] {
    return [...this.byName.values()];
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  /** Not saved yet: a project is saved once it has its first session (see Registry.ensure). */
  add(project: ProjectState): void {
    this.byName.set(project.name, project);
  }

  update(name: string, patch: ProjectPatch): void {
    Object.assign(this.get(name), patch);
    this.save();
  }
}
