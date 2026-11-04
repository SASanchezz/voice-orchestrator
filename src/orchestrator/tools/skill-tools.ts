import { z } from "zod";
import type { SkillLibrary } from "../../skills/skill-library.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

export function listSkills(library: SkillLibrary): OperatorTool {
  return defineTool({
    name: "list_skills",
    description: "List the skills (playbooks for particular requests) with their names and descriptions.",
    args: {},
    run: () => text(library.index() || "No skills available."),
  });
}

export function loadSkill(library: SkillLibrary): OperatorTool {
  return defineTool({
    name: "load_skill",
    description: "Load a skill's full playbook by name, when the request matches its description. Follow it.",
    args: { name: z.string().describe("The skill's name, as list_skills gives it") },
    run: ({ name }) => text(library.body(name)),
  });
}
