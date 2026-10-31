import type { ServerResponse } from "node:http";
import { z } from "zod";
import type { GitDefinitions } from "../../review/git-definitions.js";
import { isSymbol } from "../code-symbols.js";
import { sendJson } from "./changes-routes.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

const MAX_SYMBOL_LENGTH = 200;

/** Only a name can be asked for, so a request can't pick which file on this Mac gets read. */
const definitionQuery = z.object({
  symbol: z.string().max(MAX_SYMBOL_LENGTH).refine(isSymbol),
  file: z.string().default(""),
});

/** Where the Review view jumps to from a name in a diff. */
export class DefinitionRoutes {
  constructor(
    private access: UiAccess,
    private lookup: UiLookup,
    private definitions: GitDefinitions,
  ) {}

  async find(url: URL, project: string, res: ServerResponse): Promise<void> {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const { symbol, file } = definitionQuery.parse(Object.fromEntries(url.searchParams));
    sendJson(res, await this.definitions.of(this.lookup.folderOf(project), symbol, file));
  }
}
