import { test } from "node:test";
import assert from "node:assert/strict";
import type { VoiceBoxEvent } from "../voice-box-protocol.js";
import { BoxChooser } from "./box-chooser.js";
import { PanelBoxes, type PanelBox } from "./panel-box.js";

/** A pop-up's box with what its pop-up was told, and how often it was asked to stop for editing. */
function panelBox(): { box: PanelBox; chooser: BoxChooser; told: VoiceBoxEvent[]; edits: number[] } {
  const chooser = new BoxChooser();
  const edits: number[] = [];
  const box = new PanelBoxes(chooser, { stopToEdit: async () => void edits.push(1) }).create();
  const told: VoiceBoxEvent[] = [];
  box.attach({ tell: (event) => void told.push(event) });
  return { box, chooser, told, edits };
}

test("panel box: it isn't open before its pop-up is", () => {
  const box = new PanelBoxes(new BoxChooser(), { stopToEdit: async () => {} }).create();
  assert.equal(box.isOpen(), false);
});

test("panel box: what it is told goes to its pop-up", () => {
  const { box, told } = panelBox();
  box.tell({ kind: "ended" });
  assert.deepEqual(told, [{ kind: "ended" }]);
});

test("panel box: coming to the front makes it the box for the next recording", () => {
  const { box, chooser } = panelBox();
  box.cameToFront();
  assert.equal(chooser.box(), box);
});

test("panel box: once its pop-up closed, it takes no recording", () => {
  const { box, chooser } = panelBox();
  box.cameToFront();
  box.shut();
  assert.equal(chooser.hasBox(), false);
});

test("panel box: once its pop-up closed, it is told nothing", () => {
  const { box, told } = panelBox();
  box.shut();
  box.tell({ kind: "ended" });
  assert.deepEqual(told, []);
});

test("panel box: a click into its field stops the recording to edit", () => {
  const { box, edits } = panelBox();
  box.editing();
  assert.equal(edits.length, 1);
});
