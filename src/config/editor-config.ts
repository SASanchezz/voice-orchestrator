import { z } from "zod";
import { expandHome } from "./paths.js";

/**
 * VS Code in the web UI's Code view, served by your installed VS Code; off until you turn it on.
 * The CLI is code-tunnel, not bin/code: bin/code starts it through Electron, so stopping bin/code would leave the server running.
 */
const DEFAULT_EDITOR = {
  enabled: false,
  codePath: "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code-tunnel",
  port: 4778,
};

// A key left empty in YAML reads as null; like a missing key, it gets the default.
const missingAsUndefined = (value: unknown): unknown => value ?? undefined;
const missingAsEmpty = (value: unknown): unknown => value ?? {};

export const editorSchema = z.preprocess(
  missingAsEmpty,
  z.object({
    enabled: z.preprocess(missingAsUndefined, z.boolean().default(DEFAULT_EDITOR.enabled)),
    codePath: z.preprocess(missingAsUndefined, z.string().default(DEFAULT_EDITOR.codePath)).transform(expandHome),
    /** Where the editor server listens on 127.0.0.1; the web UI reaches it through its own port. */
    port: z.preprocess(missingAsUndefined, z.number().int().positive().default(DEFAULT_EDITOR.port)),
  }),
);
export type EditorSettings = z.infer<typeof editorSchema>;

/** What a config file without an `editor` section gets. */
export const DEFAULT_EDITOR_SETTINGS: EditorSettings = editorSchema.parse(undefined);
