import assert from "node:assert/strict";
import { test } from "node:test";
import { TrainingNews } from "./training-news.js";

/** Stands in for the operator; writes down what it was asked to say. */
class FakeAnnouncer {
  spoken: string[] = [];

  announce(spoken: string): void {
    this.spoken.push(spoken);
  }
}

function connectedNews(): { news: TrainingNews; announcer: FakeAnnouncer } {
  const news = new TrainingNews();
  const announcer = new FakeAnnouncer();
  news.connect(announcer);
  return { news, announcer };
}

test("training news: a finished training is announced with its result", () => {
  const { news, announcer } = connectedNews();
  news.trained("Trained.");
  assert.deepEqual(announcer.spoken, ["Wake word training finished. Trained."]);
});

test("training news: a failed training is announced with why", () => {
  const { news, announcer } = connectedNews();
  news.failed("No recordings.");
  assert.deepEqual(announcer.spoken, ["Wake word training failed: No recordings."]);
});
