import { test } from "node:test";
import assert from "node:assert/strict";
import { BoxChooser } from "./box-chooser.js";
import { TestBox } from "../../testing/test-boxes.js";

function chooserWith(...used: TestBox[]): BoxChooser {
  const chooser = new BoxChooser();
  used.forEach((box) => chooser.used(box));
  return chooser;
}

test("box chooser: the box used last takes the recording", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  assert.equal(chooserWith(page, popup).box(), popup);
});

test("box chooser: using a box again brings it back", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  const chooser = chooserWith(page, popup);
  chooser.used(page);
  assert.equal(chooser.box(), page);
});

test("box chooser: a closed box is passed over for the one before it", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  const chooser = chooserWith(page, popup);
  popup.open = false;
  assert.equal(chooser.box(), page);
});

test("box chooser: a forgotten box is passed over", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  const chooser = chooserWith(page, popup);
  chooser.forget(popup);
  assert.equal(chooser.box(), page);
});

test("box chooser: a claimed box comes first", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  const chooser = chooserWith(page, popup);
  chooser.claim(page);
  assert.equal(chooser.box(), page);
});

test("box chooser: a claim counts for one recording only", () => {
  const [page, popup] = [new TestBox(), new TestBox()];
  const chooser = chooserWith(page, popup);
  chooser.claim(page);
  chooser.started();
  assert.equal(chooser.box(), popup);
});

test("box chooser: with no box open, there is none", () => {
  const page = new TestBox();
  page.open = false;
  assert.equal(chooserWith(page).hasBox(), false);
});

test("box chooser: asking for a box when none is open is an error", () => {
  assert.throws(() => new BoxChooser().box(), /No message box/);
});
