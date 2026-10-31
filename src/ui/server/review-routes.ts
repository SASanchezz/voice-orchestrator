import type { ServerResponse } from "node:http";
import type { ChangesRoutes } from "./changes-routes.js";
import type { DefinitionRoutes } from "./definition-routes.js";

const ALL_CHANGES_PATH = "/api/changes";
const FILE_DIFF_PATH = /^\/api\/projects\/([^/]+)\/changes\/diff$/;
const HIDDEN_LINES_PATH = /^\/api\/projects\/([^/]+)\/changes\/lines$/;
const DEFINITIONS_PATH = /^\/api\/projects\/([^/]+)\/definitions$/;

/** Sends each GET of the Review view to the changes or the definitions. */
export class ReviewRoutes {
  constructor(
    private changes: ChangesRoutes,
    private definitions: DefinitionRoutes,
  ) {}

  handles(url: URL): boolean {
    const paths = [FILE_DIFF_PATH, HIDDEN_LINES_PATH, DEFINITIONS_PATH];
    return url.pathname === ALL_CHANGES_PATH || paths.some((path) => path.test(url.pathname));
  }

  async route(url: URL, res: ServerResponse): Promise<void> {
    if (url.pathname === ALL_CHANGES_PATH) return await this.changes.all(url, res);
    const fileDiff = url.pathname.match(FILE_DIFF_PATH);
    if (fileDiff) return await this.changes.fileDiff(url, decodeURIComponent(fileDiff[1]), res);
    const hiddenLines = url.pathname.match(HIDDEN_LINES_PATH);
    if (hiddenLines) return await this.changes.hiddenLines(url, decodeURIComponent(hiddenLines[1]), res);
    const definitions = url.pathname.match(DEFINITIONS_PATH);
    if (definitions) await this.definitions.find(url, decodeURIComponent(definitions[1]), res);
  }
}
