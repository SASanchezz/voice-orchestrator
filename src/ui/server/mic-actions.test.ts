import { test } from "node:test";
import assert from "node:assert/strict";
import type { TalkSource } from "../../voice/shared-mic.js";
import type { VoiceInputState } from "../../voice/voice-io.js";
import { BoxChooser } from "../voice-box/box-chooser.js";
import { PageBoxes } from "../voice-box/page-boxes.js";
import { MicActions } from "./mic-actions.js";

const PAGE = "page-1";

/** Stands in for the shared mic; it writes down what it's asked to do. */
class FakeMic {
  done: string[] = [];
  current: VoiceInputState = "idle";

  start(source: TalkSource): void {
    this.done.push(`start ${source}`);
  }

  keep(): Promise<string> {
    return Promise.resolve("your words");
  }

  cancel(): Promise<void> {
    this.done.push("cancel");
    return Promise.resolve();
  }

  state(): VoiceInputState {
    return this.current;
  }
}

function micActions(): { actions: MicActions; mic: FakeMic; chooser: BoxChooser; pages: PageBoxes } {
  const mic = new FakeMic();
  const pages = new PageBoxes({ isOpen: () => true, broadcast: () => {} });
  const chooser = new BoxChooser();
  return { actions: new MicActions(mic, pages, chooser), mic, chooser, pages };
}

test("mic actions: a mic button starts a recording as the button", () => {
  const { actions, mic } = micActions();
  actions.start({ page: PAGE });
  assert.deepEqual(mic.done, ["start button"]);
});

test("mic actions: a mic button claims the recording for its page", () => {
  const { actions, chooser, pages } = micActions();
  actions.start({ page: PAGE });
  assert.equal(chooser.box(), pages.of(PAGE));
});

test("mic actions: a mic button can't start a second recording", () => {
  const { actions, mic } = micActions();
  mic.current = "recording";
  assert.throws(() => actions.start({ page: PAGE }), /already recording/);
});

test("mic actions: a start without its page is refused", () => {
  const { actions } = micActions();
  assert.throws(() => actions.start({}));
});

test("mic actions: stopping to edit gives your words back", async () => {
  const { actions } = micActions();
  assert.equal(await actions.keep(), "your words");
});

test("mic actions: cancelling drops the recording", async () => {
  const { actions, mic } = micActions();
  await actions.cancel();
  assert.deepEqual(mic.done, ["cancel"]);
});

test("mic actions: the page you came to takes the next recording", () => {
  const { actions, chooser, pages } = micActions();
  actions.pageUsed({ page: PAGE });
  assert.equal(chooser.box(), pages.of(PAGE));
});

test("mic actions: a hidden page takes no recording", () => {
  const { actions, chooser } = micActions();
  actions.pageUsed({ page: PAGE });
  actions.pageHidden({ page: PAGE });
  assert.equal(chooser.hasBox(), false);
});
