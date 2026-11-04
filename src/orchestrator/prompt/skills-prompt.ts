import type { SkillLibrary } from "../../skills/skill-library.js";

/** The skills part of the system prompt: only their names and descriptions; each playbook is loaded when needed. */
export function skillsPrompt(library: SkillLibrary): string {
  const index = library.index();
  if (!index) return "";
  return `Skills: playbooks for particular requests. Only their names and descriptions are here:
${index}
- When a request matches a skill's description, call load_skill with its name before acting, and follow the playbook it returns. Call list_skills if you need the list again.
- Don't call list_skills or load_skill for requests that match no skill.`;
}
