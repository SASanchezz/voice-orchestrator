import type { SpokenMessages } from "../../orchestrator/conversation/spoken-messages.js";
import type { ChatPanel, ChatPanelDevice, ChatPanelEvents } from "../assistant-chat/chat-panel.js";
import type { PanelBoxes } from "./panel-box.js";
import type { PanelVoiceEvents, VoiceListener } from "./voice-box.js";

/** What the chat pop-up prints when it sends your spoken words, followed by them. */
const SPOKEN_PREFIX = "spoken:";

/** Chat pop-ups that also report what a voice box needs, and show the recording their field follows. */
export interface VoicedChatPanelDevice {
  open(events: ChatPanelEvents & PanelVoiceEvents): ChatPanel & VoiceListener;
}

/**
 * The assistant's chat pop-up as a voice box too: while it is the one you see, your words fill its field as you speak,
 * and sending them there reaches the assistant as speech, so it answers aloud.
 */
export class VoicedChatPanels implements ChatPanelDevice {
  constructor(
    private device: VoicedChatPanelDevice,
    private boxes: PanelBoxes,
    private spoken: Pick<SpokenMessages, "receive">,
  ) {}

  open(events: ChatPanelEvents): ChatPanel {
    const box = this.boxes.create();
    const panel = this.device.open({
      chosen: (answer) => this.chosen(answer, events),
      seen: () => events.seen(),
      closed: () => {
        box.shut();
        events.closed();
      },
      cameToFront: () => box.cameToFront(),
      editing: () => box.editing(),
    });
    box.attach(panel);
    return panel;
  }

  private chosen(answer: string, events: ChatPanelEvents): void {
    if (!answer.startsWith(SPOKEN_PREFIX)) return events.chosen(answer);
    this.spoken.receive(answer.slice(SPOKEN_PREFIX.length));
  }
}
