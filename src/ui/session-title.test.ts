import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionView, TaskRecordView } from "./session-protocol.js";
import { firstLine, sessionTopic, shortSessionTitle } from "./session-title.js";

function sessionWith(fields: Partial<SessionView>): SessionView {
  return { id: "s1", number: 1, status: "idle", queued: [], costUsd: 0, history: [], ...fields };
}

function finished(task: string): TaskRecordView {
  return { task, outcome: "done", result: "", finishedAt: "2026-11-13T10:00:00.000Z" };
}

describe("sessionTopic", () => {
  it("names a session by its oldest remembered task", () => {
    const session = sessionWith({ history: [finished("Fix the tabs"), finished("Add tests")], task: "Commit" });
    assert.equal(sessionTopic(session), "Fix the tabs");
  });

  it("names a session with no history by its running task", () => {
    assert.equal(sessionTopic(sessionWith({ task: "Fix the tabs" })), "Fix the tabs");
  });

  it("calls a session with no task new", () => {
    assert.equal(sessionTopic(sessionWith({})), "new");
  });
});

describe("firstLine", () => {
  it("takes the first written line with its spacing collapsed", () => {
    assert.equal(firstLine("\n  Fix   the\ttabs \nand more"), "Fix the tabs");
  });
});

describe("shortSessionTitle", () => {
  it("keeps a short topic whole", () => {
    assert.equal(shortSessionTitle(sessionWith({ task: "Fix the tabs" })), "Fix the tabs");
  });

  it("shows the title a model wrote instead of the task", () => {
    const session = sessionWith({ task: "fix ## 4. Black screen under popups", title: "Black screen under popups" });
    assert.equal(shortSessionTitle(session), "Black screen under popups");
  });

  it("drops markdown markers from a task used as the title", () => {
    const task = "fix ## 4. Black screen under **popups** when the `device` rotates";
    assert.equal(shortSessionTitle(sessionWith({ task })), "fix Black screen under popups when the device…");
  });

  it("cuts a long topic at a whole word", () => {
    const task = "I wish to enhance UI tweaks of our tabs, first their positioning and padding";
    assert.equal(shortSessionTitle(sessionWith({ task })), "I wish to enhance UI tweaks of our tabs, first…");
  });
});
