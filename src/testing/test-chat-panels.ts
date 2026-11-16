import type { ChatPanel, ChatPanelDevice, ChatPanelEvents, ChatView } from "../ui/assistant-chat/chat-panel.js";
import type { VoiceListener } from "../ui/voice-box/voice-box.js";
import type { VoiceBoxEvent } from "../ui/voice-box-protocol.js";

/** A fake chat pop-up as a test sees it: what it shows, how often it came up, and its clicks, messages and closing. */
export interface TestChatPanel {
  view: ChatView | undefined;
  raised: number;
  events: ChatPanelEvents;
  /** What it was told about the recording its field follows. */
  told: VoiceBoxEvent[];
}

/** Fake chat pop-ups: tests read what is shown, click, write, or close one as you would. */
export class TestChatPanels implements ChatPanelDevice {
  opened: TestChatPanel[] = [];

  open(events: ChatPanelEvents): ChatPanel & VoiceListener {
    const shown: TestChatPanel = { view: undefined, raised: 0, events, told: [] };
    this.opened.push(shown);
    return {
      update: (view) => void (shown.view = view),
      raise: () => void shown.raised++,
      tell: (event) => void shown.told.push(event),
    };
  }

  /** The last pop-up opened. */
  latest(): TestChatPanel {
    const shown = this.opened.at(-1);
    if (!shown) throw new Error("No chat pop-up was opened.");
    return shown;
  }
}
