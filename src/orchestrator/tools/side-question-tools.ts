import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { SideQuestions } from "../../workers/side-questions.js";
import {
  defineTool,
  needProject,
  optionalSessionArg,
  projectArg,
  sessionOf,
  text,
  type OperatorTool,
} from "./tool-kit.js";

export function askSideQuestion(sideQuestions: SideQuestions, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "ask_side_question",
    description:
      "Ask a session's worker a quick question by the way (Claude Code's /btw), answered from what it already knows " +
      "while its task goes on; nothing is queued or interrupted. Returns the answer to read out.",
    args: {
      project: projectArg,
      session: optionalSessionArg,
      question: z.string().min(1).describe("The question, in the user's words"),
    },
    run: async ({ project, session, question }) => {
      const sessionId = sessionOf(registry, needProject(cfg, project), session).id;
      return text(await sideQuestions.answer(sessionId, question));
    },
  });
}
