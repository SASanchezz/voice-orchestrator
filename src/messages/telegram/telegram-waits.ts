import { TelegramWaitError } from "./telegram-port.js";

export type Wait = (ms: number) => Promise<void>;

/** Longer waits are reported rather than sat through, since you're waiting for the answer. */
const MAX_WAIT_SECONDS = 30;
const MS_PER_SECOND = 1000;

/** Runs a Telegram request; after a short FloodWait it waits and tries once more, a long one is passed on. */
export async function withShortWaits<Result>(wait: Wait, request: () => Promise<Result>): Promise<Result> {
  try {
    return await request();
  } catch (error) {
    if (!isShortWait(error)) throw error;
    await wait(error.seconds * MS_PER_SECOND);
    return request();
  }
}

function isShortWait(error: unknown): error is TelegramWaitError {
  return error instanceof TelegramWaitError && error.seconds <= MAX_WAIT_SECONDS;
}
