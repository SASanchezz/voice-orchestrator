import type { ServerResponse } from "node:http";
import type { ChangesRoutes } from "./changes-routes.js";
import type { CompareRoutes } from "./compare-routes.js";
import type { DefinitionRoutes } from "./definition-routes.js";

const ALL_CHANGES_PATH = "/api/changes";

/** Each takes the project named in the path. */
type ProjectRoute = (url: URL, project: string, res: ServerResponse) => Promise<void>;

/** Sends each GET of the Review view to the changes, the branch comparison or the definitions. */
export class ReviewRoutes {
  private readonly projectRoutes: [RegExp, ProjectRoute][];

  constructor(
    private changes: ChangesRoutes,
    definitions: DefinitionRoutes,
    compare: CompareRoutes,
  ) {
    this.projectRoutes = [
      [/^\/api\/projects\/([^/]+)\/changes\/diff$/, (u, p, r) => changes.fileDiff(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/changes\/lines$/, (u, p, r) => changes.hiddenLines(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/definitions$/, (u, p, r) => definitions.find(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/branches$/, (u, p, r) => compare.branches(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/compare$/, (u, p, r) => compare.files(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/compare\/diff$/, (u, p, r) => compare.fileDiff(u, p, r)],
      [/^\/api\/projects\/([^/]+)\/compare\/lines$/, (u, p, r) => compare.hiddenLines(u, p, r)],
    ];
  }

  handles(url: URL): boolean {
    return url.pathname === ALL_CHANGES_PATH || this.projectRoutes.some(([path]) => path.test(url.pathname));
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    if (url.pathname === ALL_CHANGES_PATH) return await this.changes.all(url, res);
    for (const [path, handle] of this.projectRoutes) {
      const match = url.pathname.match(path);
      if (match) return await handle(url, decodeURIComponent(match[1]), res);
    }
  }
}
