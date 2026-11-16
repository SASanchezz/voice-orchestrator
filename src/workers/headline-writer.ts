import type { QuickModel } from "./quick-model.js";

/** The topic of a dictated task shows early; the rest only costs tokens. */
const TASK_CHARS = 1000;
/** A worker ends its closing note with a plain-language summary of what it did. */
const NOTE_CHARS = 1200;
const HEADLINE_CHARS = 100;
const WRAPPING_QUOTES = /^["'«“`]+|["'»”`.]+$/g;

/** Says in a few words what a finished task's work was about and what got done, to be read out when it ends. */
export class HeadlineWriter {
  constructor(private model: Pick<QuickModel, "ask">) {}

  async write(project: string, task: string, closingNote: string): Promise<string> {
    const reply = await this.model.ask(project, HeadlineWriter.promptFor(task, closingNote), "headline");
    return HeadlineWriter.cleaned(reply);
  }

  private static promptFor(task: string, closingNote: string): string {
    return (
      `Someone gave a coding assistant this task, often dictated by voice:\n\n${task.slice(0, TASK_CHARS)}\n\n` +
      `The assistant finished. The end of its closing note:\n\n${closingNote.slice(-NOTE_CHARS)}\n\n` +
      "Write a 5 to 10 word headline to be read aloud: first the topic of the work, then what was done, " +
      'like "Worker pop-ups: notices now name the topic". Use the task\'s own language and plain words, ' +
      "not the task's opening words. Reply with the headline only: no quotes, no markdown, no full stop."
    );
  }

  private static cleaned(reply: string): string {
    const headline = reply.split("\n")[0].replace(WRAPPING_QUOTES, "").trim().slice(0, HEADLINE_CHARS);
    if (!headline) throw new Error("headline came back empty");
    return headline;
  }
}
