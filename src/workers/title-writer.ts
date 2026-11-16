import type { QuickModel } from "./quick-model.js";

/** A long dictated task names its subject early; the rest only costs tokens. */
const TASK_CHARS = 2000;
const TITLE_CHARS = 60;
const WRAPPING_QUOTES = /^["'«“`]+|["'»”`.]+$/g;

/** Names a task in a few words, as a headline of its main subject, for its session's tab. */
export class TitleWriter {
  constructor(private model: Pick<QuickModel, "ask">) {}

  async write(project: string, task: string): Promise<string> {
    const reply = await this.model.ask(project, TitleWriter.promptFor(task), "title");
    return TitleWriter.cleaned(reply);
  }

  private static promptFor(task: string): string {
    return (
      `Someone gave a coding assistant this task, often dictated by voice:\n\n${task.slice(0, TASK_CHARS)}\n\n` +
      "Name its main subject in 3 to 6 words, like a short headline for a tab, in the task's own language. " +
      "Keep the key nouns (the feature, screen, bug or tool), drop filler such as please, can you or I want. " +
      "Reply with the title only: no quotes, no markdown, no full stop."
    );
  }

  private static cleaned(reply: string): string {
    const title = reply.split("\n")[0].replace(WRAPPING_QUOTES, "").trim().slice(0, TITLE_CHARS);
    if (!title) throw new Error("title came back empty");
    return title;
  }
}
