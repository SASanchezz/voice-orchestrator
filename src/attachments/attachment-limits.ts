// Shared by the server and the web page, so the page refuses a file before sending what the server would refuse.

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 10_485_760; // 10 MiB
export const MAX_ATTACHMENTS_TOTAL_BYTES = 20_971_520; // 20 MiB
/** How long your voice message waits for your choice whether the draft's files go with it; then it goes without them. */
export const VOICE_MESSAGE_WAIT_MS = 30_000;
