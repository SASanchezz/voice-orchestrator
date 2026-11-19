import { errorMessage } from "../../shared/errors.js";
import type { SetupCheck } from "../../ui/reply-checkup-views.js";
import type { OpenTelegram } from "./telegram-port.js";

/** Whether Telegram accepts the saved login now, over the app's one shared connection. */
export class TelegramSetupCheck {
  constructor(private open: OpenTelegram) {}

  async check(): Promise<SetupCheck[]> {
    return [await this.signedIn()];
  }

  private async signedIn(): Promise<SetupCheck> {
    const label = "Signed in";
    try {
      return { label, status: "ok", detail: `Telegram accepts the login; ${await this.chatCount()} chats.` };
    } catch (error) {
      return {
        label,
        status: "fail",
        detail: errorMessage(error),
        fix: "Log in again:",
        command: "npm run telegram-login",
      };
    }
  }

  private async chatCount(): Promise<number> {
    const telegram = await this.open();
    try {
      return (await telegram.listChats()).length;
    } finally {
      await telegram.close();
    }
  }
}
