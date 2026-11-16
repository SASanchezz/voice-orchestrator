import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { ChatPanel, ChatPanelEvents, ChatView } from "../ui/assistant-chat/chat-panel.js";
import type { VoicedChatPanelDevice } from "../ui/voice-box/voiced-chat-panels.js";
import type { PanelVoiceEvents, VoiceListener } from "../ui/voice-box/voice-box.js";
import { buildNativeHelper } from "./native-helper.js";
import { SEEN_LINE } from "./panel-output.js";
import { passOnVoiced, voiceCommandLine } from "./panel-voice.js";

const SHOW_COMMAND = { command: "show" };

/**
 * Chat pop-ups from a Swift helper that stays running while the pop-up is open. Views and the recording its field
 * follows go to its stdin as one JSON object per line, so a long dialogue never ends up on a command line; each click
 * or message comes back as a line.
 */
export class MacChatPanels implements VoicedChatPanelDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacChatPanels> {
    return new MacChatPanels(await buildNativeHelper("chat-panel"));
  }

  open(events: ChatPanelEvents & PanelVoiceEvents): ChatPanel & VoiceListener {
    const helper = spawn(this.helperPath, [], { stdio: ["pipe", "pipe", "inherit"] });
    helper.stdin.on("error", () => {}); // you closed it before the next view reached it
    createInterface({ input: helper.stdout }).on("line", (line) =>
      passOnVoiced(line, events, (rest) => passOn(rest, events)),
    );
    helper.once("exit", () => events.closed());
    const send = (command: object) => helper.stdin.write(`${JSON.stringify(command)}\n`);
    return {
      update: (view: ChatView) => send({ command: "dialogue", ...view }),
      raise: () => send(SHOW_COMMAND),
      tell: (event) => void helper.stdin.write(voiceCommandLine(event)),
    };
  }
}

/** Your first click into the pop-up since it last came up, or a click or message that answers. */
function passOn(printed: string, events: ChatPanelEvents): void {
  if (printed === SEEN_LINE) return events.seen();
  events.chosen(printed);
}
