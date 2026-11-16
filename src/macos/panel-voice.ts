import type { PanelVoiceEvents } from "../ui/voice-box/voice-box.js";
import type { VoiceBoxEvent } from "../ui/voice-box-protocol.js";

/** A pop-up with a text field prints these (see native/shared/voice-panel.swift). */
const FRONT_LINE = "front";
const EDIT_LINE = "edit";

/** Lines about the pop-up's field go to `voice`; the rest go on. */
export function passOnVoiced(line: string, voice: PanelVoiceEvents, onward: (line: string) => void): void {
  const printed = line.trim();
  if (printed === FRONT_LINE) return voice.cameToFront();
  if (printed === EDIT_LINE) return voice.editing();
  onward(printed);
}

/** What happens to the recording the pop-up's field follows, as a line for its stdin. */
export function voiceCommandLine(event: VoiceBoxEvent): string {
  return `${JSON.stringify({ command: "voice", ...event })}\n`;
}
