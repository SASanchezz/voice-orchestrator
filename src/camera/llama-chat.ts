import { z } from "zod";
import type { CameraFrame } from "./camera-source.js";
import type { VisionPrompt } from "./vision-prompts.js";

/** Facts, not creativity. */
const TEMPERATURE = 0.2;

type UserPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** The body of POST /v1/chat/completions, as far as it is used here. */
interface ChatRequest {
  messages: [{ role: "system"; content: string }, { role: "user"; content: UserPart[] }];
  max_tokens: number;
  temperature: number;
}

/** The body for POST /v1/chat/completions: the frame goes inline as a data URL, next to the user's question. */
export function chatRequest(frame: CameraFrame, question: string, prompt: VisionPrompt): ChatRequest {
  const image = { url: `data:${frame.mimeType};base64,${frame.data}` };
  return {
    messages: [
      { role: "system", content: prompt.system },
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: image },
        ],
      },
    ],
    max_tokens: prompt.maxTokens,
    temperature: TEMPERATURE,
  };
}

const replySchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().trim().min(1) }) })).min(1),
});

/** The description in the server's reply: the first choice's text. */
export function replyText(reply: unknown): string {
  const parsed = replySchema.safeParse(reply);
  if (!parsed.success)
    throw new Error(`The local vision model's reply was not understood: ${z.prettifyError(parsed.error)}`);
  return parsed.data.choices[0].message.content;
}
