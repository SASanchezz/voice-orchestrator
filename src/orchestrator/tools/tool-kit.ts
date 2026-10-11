import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import { resolveProject } from "../../config/project-names.js";
import { errorMessage } from "../../shared/errors.js";

type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  content: ToolContent[];
}

export function text(message: string): ToolResult {
  return { content: [{ type: "text", text: message }] };
}

/** A tool as it is written: its name and description for the model, its arguments, and what it does. */
export interface ToolSpec<Args extends z.ZodRawShape> {
  name: string;
  description: string;
  args: Args;
  run(args: z.infer<z.ZodObject<Args>>): Promise<ToolResult> | ToolResult;
}

/** A tool the operator can call; errors come back as text it can read aloud, instead of crashing the session. */
export interface OperatorTool {
  name: string;
  description: string;
  args: z.ZodRawShape;
  call(args: unknown): Promise<ToolResult>;
}

export function defineTool<Args extends z.ZodRawShape>(spec: ToolSpec<Args>): OperatorTool {
  const schema = z.object(spec.args);
  const { name, description, args } = spec;
  return { name, description, args, call: (input) => readableErrors(async () => spec.run(schema.parse(input))) };
}

async function readableErrors(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (e) {
    return text(`Error: ${errorMessage(e)}`);
  }
}

export const projectArg = z.string().describe("Project name as spoken; matched loosely");
export const sessionNumberArg = z
  .number()
  .int()
  .positive()
  .describe("Session number within the project, as in 'session 2'");

export function accountArg(cfg: AppConfig): z.ZodString {
  return z.string().describe(`Account: ${Object.keys(cfg.profiles).join(" | ")}`);
}

/** The known project a spoken name means; an error the model can read out if there is none. */
export function needProject(cfg: AppConfig, spoken: string): string {
  const name = resolveProject(cfg, spoken);
  if (name) return name;
  const known = Object.keys(cfg.projects).join(", ") || "none";
  throw new Error(`No project like "${spoken}". Known: ${known}. Use open_project to add it.`);
}
