import type { CameraFrame } from "./camera-source.js";
import type { FrameDescriber } from "./frame-describer.js";
import { timed } from "../shared/timing.js";
import { chatRequest, replyText } from "./llama-chat.js";
import type { VisionPrompt } from "./vision-prompts.js";

/** A small model on Apple silicon answers in a few seconds; much longer means the server is stuck. */
const TIMEOUT_MS = 30_000;

/** A vision model behind an OpenAI-compatible server such as llama-server, see docs/local-vision.md. */
export class LlamaDescriber implements FrameDescriber {
  constructor(
    private server: string,
    private post: typeof fetch,
    private prompt: VisionPrompt,
  ) {}

  async describe(frame: CameraFrame, question: string): Promise<string> {
    const body = JSON.stringify(chatRequest(frame, question, this.prompt));
    const reply = await timed("local vision model", () => this.chat(body));
    return replyText(reply);
  }

  private async chat(body: string): Promise<unknown> {
    const response = await this.post(new URL("/v1/chat/completions", this.server), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((e: unknown) => {
      throw new Error(`The local vision model at ${this.server} is not reachable`, { cause: e });
    });
    if (!response.ok) throw new Error(`The local vision model answered ${response.status}: ${await response.text()}`);
    return response.json();
  }
}
