import type { OpenPanel, QuestionPanel, QuestionPanelDevice, QuestionPanelEvents } from "../question-popups.js";
import type { PanelBoxes } from "./panel-box.js";
import type { PanelVoiceEvents, VoiceListener } from "./voice-box.js";

/** Question pop-ups that also report what a voice box needs, and show the recording their field follows. */
export interface VoicedQuestionPanelDevice {
  ask(panel: QuestionPanel, events: QuestionPanelEvents & PanelVoiceEvents): OpenPanel & VoiceListener;
}

/**
 * A worker's question pop-up as a voice box too: while it is the one you see, your words fill its answer field as you
 * speak, and sending them answers the question, as typing there does.
 */
export class VoicedQuestionPanels implements QuestionPanelDevice {
  constructor(
    private device: VoicedQuestionPanelDevice,
    private boxes: PanelBoxes,
  ) {}

  ask(panel: QuestionPanel, events: QuestionPanelEvents): OpenPanel {
    const box = this.boxes.create();
    const open = this.device.ask(panel, {
      ...events,
      cameToFront: () => box.cameToFront(),
      editing: () => box.editing(),
    });
    box.attach(open);
    return {
      close: () => {
        box.shut();
        open.close();
      },
    };
  }
}
