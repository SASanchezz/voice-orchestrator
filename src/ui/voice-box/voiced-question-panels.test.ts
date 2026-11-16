import { test } from "node:test";
import assert from "node:assert/strict";
import { TestQuestionPanels } from "../../testing/test-panels.js";
import type { QuestionPanel } from "../question-popups.js";
import { BoxChooser } from "./box-chooser.js";
import { PanelBoxes } from "./panel-box.js";
import type { PanelVoiceEvents } from "./voice-box.js";
import { VoicedQuestionPanels } from "./voiced-question-panels.js";

const PANEL: QuestionPanel = { title: "webshop asks: Which database?", detail: "", buttons: [], acceptsText: true };

/** A question pop-up wrapped as a voice box, with the voice events the pop-up reports. */
function voicedQuestion() {
  const device = new VoicedFake();
  const chooser = new BoxChooser();
  const chosen: string[] = [];
  const open = new VoicedQuestionPanels(device, new PanelBoxes(chooser, { stopToEdit: async () => {} })).ask(PANEL, {
    chosen: (answer) => void chosen.push(answer),
    seen: () => {},
  });
  return { device, chooser, chosen, open };
}

/** Fake question pop-ups that also keep the voice events each was given. */
class VoicedFake extends TestQuestionPanels {
  voice: PanelVoiceEvents[] = [];

  ask(panel: QuestionPanel, events: Parameters<TestQuestionPanels["ask"]>[1] & PanelVoiceEvents) {
    this.voice.push(events);
    return super.ask(panel, events);
  }
}

test("voiced question: the pop-up coming to the front makes it the box for the next recording", () => {
  const { device, chooser } = voicedQuestion();
  device.voice[0]?.cameToFront();
  assert.equal(chooser.hasBox(), true);
});

test("voiced question: answers go to the pop-up's owner as before", () => {
  const { device, chosen } = voicedQuestion();
  device.latest().choose("text:Postgres");
  assert.deepEqual(chosen, ["text:Postgres"]);
});

test("voiced question: closing the pop-up closes it", () => {
  const { device, open } = voicedQuestion();
  open.close();
  assert.equal(device.latest().closed, true);
});

test("voiced question: once closed, the pop-up takes no recording", () => {
  const { device, chooser, open } = voicedQuestion();
  device.voice[0]?.cameToFront();
  open.close();
  assert.equal(chooser.hasBox(), false);
});
