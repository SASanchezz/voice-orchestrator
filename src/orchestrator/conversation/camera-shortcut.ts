import type { CameraSource } from "../../camera/camera-source.js";
import type { FrameDescriber } from "../../camera/frame-describer.js";
import { timed } from "../../shared/timing.js";
import { isQuickCameraQuestion } from "./camera-question.js";
import type { ConversationLine } from "./conversation-lines.js";
import type { Turn, TurnTaker, UserTurnTaker } from "./turn-taker.js";

const LOG = "[camera]";

type Turns = Pick<TurnTaker, "take" | "takeAnswered" | "showLine">;

/**
 * Quick camera questions ("can you see me?") answered by the local vision model alone, which skips the operator
 * model's two calls. Anything else, or a camera that can't answer (Gestures off, server down), gets the usual turn.
 */
export class CameraShortcut implements UserTurnTaker {
  constructor(
    private camera: CameraSource,
    private answerer: FrameDescriber,
    private turns: Turns,
  ) {}

  take(turn: Turn): Promise<string> {
    const question = turn.utterance;
    if (!question || !isQuickCameraQuestion(question)) return this.turns.take(turn);
    return this.takeLocally(turn, question);
  }

  showLine(line: ConversationLine): void {
    this.turns.showLine(line);
  }

  private async takeLocally(turn: Turn, question: string): Promise<string> {
    let reply: string;
    try {
      reply = await this.answer(question);
    } catch (error: unknown) {
      return this.fallBack(turn, error);
    }
    return this.turns.takeAnswered(turn, reply);
  }

  private answer(question: string): Promise<string> {
    return timed("camera answered without the model", async () =>
      this.answerer.describe(await this.camera.latest(), question),
    );
  }

  private fallBack(turn: Turn, error: unknown): Promise<string> {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`${LOG} no quick answer, asking the model instead: ${reason}`);
    return this.turns.take(turn);
  }
}
