import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { Writable } from "node:stream";

/** Questions in the terminal, for setup scripts; a secret is typed without being echoed or kept in history. */
export class TerminalPrompts {
  private muted = false;
  private prompts: Interface;

  constructor() {
    const output = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        if (!this.muted) stdout.write(chunk);
        done();
      },
    });
    this.prompts = createInterface({ input: stdin, output, terminal: true, historySize: 0 });
  }

  async ask(question: string): Promise<string> {
    return (await this.prompts.question(question)).trim();
  }

  async askHidden(question: string): Promise<string> {
    stdout.write(question);
    this.muted = true;
    const answer = await this.prompts.question("");
    this.muted = false;
    stdout.write("\n");
    return answer.trim();
  }

  close(): void {
    this.prompts.close();
  }
}
