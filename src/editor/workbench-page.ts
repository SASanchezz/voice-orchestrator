import { z } from "zod";

/** Its icons go in the sidebar's title, so they don't take a column of their own. */
const ACTIVITY_BAR_ON_TOP = { "workbench.activityBar.location": "top" };

/** Where VS Code's web page carries its startup options, as an HTML-escaped JSON attribute. */
const OPTIONS_TAG = /(<meta id="vscode-workbench-web-configuration" data-settings=")([^"]*)(")/;
const optionsSchema = z.looseObject({ configurationDefaults: z.record(z.string(), z.unknown()).optional() });

const UNESCAPED: Record<string, string> = { "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&" };
const ESCAPED: Record<string, string> = { '"': "&quot;", "<": "&lt;", ">": "&gt;", "&": "&amp;" };

/**
 * The editor's page with `theme` as its default color theme and more room for code. VS Code in the browser defaults to
 * a light theme, unlike the desktop app; whatever you set inside the editor still wins. A page without the options tag
 * is left as it is.
 */
export function withWorkbenchDefaults(page: string, theme: string): string {
  const tag = OPTIONS_TAG.exec(page);
  if (!tag) return page;
  const options = optionsSchema.parse(JSON.parse(unescapeAttribute(tag[2])));
  const defaults = { ...ACTIVITY_BAR_ON_TOP, "workbench.colorTheme": theme };
  const configurationDefaults = { ...options.configurationDefaults, ...defaults };
  const themed = escapeAttribute(JSON.stringify({ ...options, configurationDefaults }));
  const [whole, start, , end] = tag;
  return page.slice(0, tag.index) + start + themed + end + page.slice(tag.index + whole.length);
}

function unescapeAttribute(value: string): string {
  return value.replace(/&(quot|#39|lt|gt|amp);/g, (entity) => UNESCAPED[entity]);
}

function escapeAttribute(value: string): string {
  return value.replace(/["<>&]/g, (char) => ESCAPED[char]);
}
