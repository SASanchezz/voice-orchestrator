import type { ChatPanel, ChatPanelDevice, ChatPanelEvents, ChatView } from "../ui/assistant-chat/chat-panel.js";

/** A fake chat pop-up as a test sees it: what it shows, how often it came up, and its clicks, messages and closing. */
export interface TestChatPanel {
  view: ChatView | undefined;
  raised: number;
  events: ChatPanelEvents;
}

/** Fake chat pop-ups: tests read what is shown, click, write, or close one as you would. */
export class TestChatPanels implements ChatPanelDevice {
  opened: TestChatPanel[] = [];

  open(events: ChatPanelEvents): ChatPanel {
    const shown: TestChatPanel = { view: undefined, raised: 0, events };
    this.opened.push(shown);
    return {
      update: (view) => void (shown.view = view),
      raise: () => void shown.raised++,
    };
  }

  /** The last pop-up opened. */
  latest(): TestChatPanel {
    const shown = this.opened.at(-1);
    if (!shown) throw new Error("No chat pop-up was opened.");
    return shown;
  }
}
