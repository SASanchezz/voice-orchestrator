import { ShellLexer, type ShellToken } from "./shell-lexer.js";
import { ShellSyntaxError, type ShellWord } from "./shell-words.js";

/** One simple command of a command line: what runs between &&, ||, ;, |, & and line breaks. */
export interface ShellSegment {
  words: ShellWord[];
  /** As written, for programs that run text they are given as code (a shell, SQL, Python…). */
  raw: string;
  /** Files written by >, >> and the like; /dev/null and the standard streams aren't files. */
  writes: string[];
  /** Files read by <. */
  reads: string[];
  /** Text fed in by heredocs and here-strings. */
  stdin: string[];
  /** Commands in $(…) and `…`, run first. */
  substitutions: string[];
}

const SEPARATORS = new Set(["&&", "||", ";;", ";", "|", "|&", "&", "\n", "(", ")"]);
const HEREDOCS = new Set(["<<", "<<-"]);
const HARMLESS_TARGET = /^(\/dev\/(null|stdout|stderr|tty)|\d|-)$/;
/** Grouping and negation, not programs. */
const SHELL_PUNCTUATION = new Set(["{", "}", "!"]);

/** The simple commands in a command line, in order. Throws ShellSyntaxError on incomplete shell. */
export function parseShell(command: string): ShellSegment[] {
  return new SegmentBuilder(new ShellLexer(command)).build();
}

class SegmentBuilder {
  private segments: ShellSegment[] = [];
  private current = emptySegment();
  private span?: { start: number; end: number };
  private heredocsDue: { segment: ShellSegment; delimiter: string }[] = [];

  constructor(private lexer: ShellLexer) {}

  build(): ShellSegment[] {
    for (let token = this.lexer.next(); token; token = this.lexer.next()) this.take(token);
    if (this.heredocsDue.length) throw new ShellSyntaxError("A heredoc never starts");
    this.finishSegment();
    return this.segments;
  }

  private take(token: ShellToken): void {
    if (token.kind === "word") return this.addWord(token.word, token);
    if (SEPARATORS.has(token.op)) return this.separate(token.op);
    this.cover(token);
    const target = this.lexer.next();
    if (target?.kind !== "word") throw new ShellSyntaxError(`${token.op} has nothing to redirect to`);
    this.cover(target);
    this.current.substitutions.push(...target.word.substitutions);
    this.redirect(token.op, target.word.text);
  }

  private addWord(word: ShellWord, token: ShellToken): void {
    this.cover(token);
    this.current.substitutions.push(...word.substitutions);
    if (word.quoted || !SHELL_PUNCTUATION.has(word.text)) this.current.words.push(word);
  }

  private redirect(op: string, target: string): void {
    if (HEREDOCS.has(op)) this.heredocsDue.push({ segment: this.current, delimiter: target });
    else if (op === "<<<") this.current.stdin.push(target);
    else if (op === "<") this.current.reads.push(target);
    else if (!HARMLESS_TARGET.test(target)) this.current.writes.push(target);
  }

  /** A line break starts the bodies of the heredocs opened on that line. */
  private separate(op: string): void {
    this.finishSegment();
    if (op !== "\n") return;
    for (const { segment, delimiter } of this.heredocsDue) segment.stdin.push(this.lexer.heredocBody(delimiter));
    this.heredocsDue = [];
  }

  private cover({ start, end }: ShellToken): void {
    this.span = { start: this.span?.start ?? start, end };
  }

  private finishSegment(): void {
    if (this.span) {
      this.current.raw = this.lexer.source.slice(this.span.start, this.span.end);
      this.segments.push(this.current);
    }
    this.current = emptySegment();
    this.span = undefined;
  }
}

function emptySegment(): ShellSegment {
  return { words: [], raw: "", writes: [], reads: [], stdin: [], substitutions: [] };
}
