import { z } from "zod";

/** Socket Mode's wrapper around everything Slack sends; anything else in it is ignored. */
const envelopeSchema = z.object({
  type: z.string(),
  /** Set on what needs an acknowledgement, which must go back within 3 seconds. */
  envelope_id: z.string().optional(),
  payload: z.object({ event: z.unknown() }).optional(),
});

export type Envelope = z.infer<typeof envelopeSchema>;

/** Slack's message types in the envelope's `type`. */
export const ENVELOPE_TYPES = { hello: "hello", disconnect: "disconnect", event: "events_api" } as const;

/** What Slack sent, or undefined when it isn't a Socket Mode envelope. */
export function envelopeOf(text: string): Envelope | undefined {
  try {
    return envelopeSchema.parse(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** The reply that tells Slack an envelope arrived, so it isn't delivered again. */
export function acknowledgement(envelopeId: string): string {
  return JSON.stringify({ envelope_id: envelopeId });
}
