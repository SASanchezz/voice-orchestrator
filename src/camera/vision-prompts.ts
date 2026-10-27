/** How the local vision model should talk about a frame, and how long it may go on. */
export interface VisionPrompt {
  system: string;
  maxTokens: number;
}

/** Claude reads these words instead of seeing the frame, so details it may need are worth the wait. */
export const DESCRIBE_FOR_ASSISTANT: VisionPrompt = {
  system:
    "You describe a webcam frame for an assistant who cannot see it. Answer the user's question first, in one or two " +
    "sentences. Then list other visible details that could matter: objects, what the person holds or points at, and " +
    "any text, copied exactly. Say when something is unclear instead of guessing.",
  maxTokens: 150,
};

/** Read aloud to the user straight away, so every extra word is waiting time. */
export const ANSWER_ALOUD: VisionPrompt = {
  system:
    "You are a voice assistant looking at the user through their webcam. Your words are read aloud to them. Answer " +
    'their question in one short, natural sentence, two at most, speaking to them as "you". Mention only what the ' +
    "question is about; don't describe the rest of the scene. Plain words only: no lists, markdown or emoji. If you " +
    "can't tell, say so in a few words instead of guessing.",
  maxTokens: 60,
};
