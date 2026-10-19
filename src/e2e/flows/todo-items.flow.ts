import { test } from "node:test";
import assert from "node:assert/strict";
import { app, uiToken, uiUrl } from "../support/harness.js";
import { chatHas, feedHas, firstChunk, uiPost } from "../support/helpers.js";

const { tools } = app.operator;
const { todoItems } = app.todo;

const itemTitled = (title: string) => todoItems.list().find((item) => item.title === title);
const idOf = (title: string): number => itemTitled(title)?.id ?? 0;

test("todo items: the assistant adds an item for a project", async () => {
  const reply = await tools.callTool("add_todo_item", {
    title: "Fix the login redirect",
    description: "After signing in, the page loops back to /login.",
    project: "dbadmin",
  });
  assert.match(reply, /^Added #\d+ Fix the login redirect \(dbadmin\)\.$/);
});

test("todo items: the assistant moves an item to another project, found by words from it", async () => {
  const reply = await tools.callTool("edit_todo_item", { item: "login redirect", project: "acme-web" });
  assert.match(reply, /Fix the login redirect \(acme-web\)/);
});

test("todo items: an unknown project is refused with the known ones", async () => {
  const reply = await tools.callTool("edit_todo_item", { item: "login redirect", project: "nowhere at all" });
  assert.match(reply, /^Error: No project like "nowhere at all"/);
});

test("todo items: the open list shows each item's project and description", async () => {
  const listing = await tools.callTool("list_todo_items", {});
  assert.match(listing, /Fix the login redirect \(acme-web\) \[open\].*\n {2}After signing in/);
});

test("todo items: a ticked-off item leaves the open list", async () => {
  await tools.callTool("set_todo_item_done", { item: "login redirect", done: true });
  assert.equal(await tools.callTool("list_todo_items", {}), "No such items on the to-do list.");
});

test("todo items: deleting says what went and how to bring it back", async () => {
  const reply = await tools.callTool("delete_todo_item", { item: "login redirect" });
  assert.match(reply, /^Deleted #\d+ Fix the login redirect \(acme-web\): After signing in.*restore_todo_item/);
});

test("todo items: the last deleted item comes back as it was", async () => {
  await tools.callTool("restore_todo_item", {});
  assert.equal(itemTitled("Fix the login redirect")?.done, true);
});

test("todo items: the page adds an item", async () => {
  const res = await uiPost("/api/todo-items", {
    title: "Ping from the page",
    description: "Say hi.",
    project: "dbadmin",
  });
  assert.equal(res.status, 200);
  await feedHas(/^Added to-do item #\d+ Ping from the page \(dbadmin\)\.$/);
});

test("todo items: the page shows the list in its state", async () => {
  const state = await firstChunk(await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl)));
  assert.match(state, /"todo":\{"items":\[.*"title":"Ping from the page","description":"Say hi\.","project":"dbadmin"/);
});

test("todo items: the page refuses a project that isn't registered", async () => {
  const res = await uiPost("/api/todo-items", { title: "Somewhere else", description: "", project: "nowhere" });
  assert.equal(res.status, 404);
});

test("todo items: the page edits an item and takes it off its project", async () => {
  const id = idOf("Ping from the page");
  await uiPost(`/api/todo-items/${id}/edit`, { title: "Ping from the page", description: "Say hello.", project: "" });
  assert.deepEqual([todoItems.find(id).description, todoItems.find(id).project], ["Say hello.", undefined]);
});

test("todo items: the page ticks an item off", async () => {
  const id = idOf("Ping from the page");
  await uiPost(`/api/todo-items/${id}/done`, { done: true });
  assert.equal(todoItems.find(id).done, true);
});

test("todo items: an item deleted on the page is offered for undo", async () => {
  const id = idOf("Ping from the page");
  await uiPost(`/api/todo-items/${id}/delete`, {});
  const state = await firstChunk(await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl)));
  assert.match(state, /"lastDeleted":\{"id":\d+,"title":"Ping from the page"/);
});

test("todo items: Undo on the page restores the deleted item", async () => {
  const deleted = app.todo.todoTrash.deleted().at(-1);
  await uiPost(`/api/todo-items/${deleted?.id ?? 0}/restore`, {});
  assert.ok(itemTitled("Ping from the page"));
});

test("todo items: an item without a project can't be sent", async () => {
  const res = await uiPost(`/api/todo-items/${idOf("Ping from the page")}/send`, {});
  assert.notEqual(res.status, 200);
});

test("todo items: one click sends an item to its project's worker as a task", async () => {
  await uiPost("/api/todo-items", { title: "Echo from the list", description: "run: echo listed", project: "dbadmin" });
  await uiPost(`/api/todo-items/${idOf("Echo from the list")}/send`, {});
  await chatHas(app.core.registry.activeSession("dbadmin").id, /^Echo from the list\n\nrun: echo listed$/);
});

test("todo items: the assistant sends an item to its project too", async () => {
  const reply = await tools.callTool("send_todo_item", { item: "echo from the list" });
  assert.match(reply, /dbadmin/);
});
