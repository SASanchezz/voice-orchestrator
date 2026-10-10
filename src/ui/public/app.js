// Orchestrator UI. Everything a worker or the model wrote is inserted as text, never as HTML.

import { el, button, collapsible, formatTime, timeAgo, autoGrow, localRead, localWrite } from "./dom.js";
import { ChatView } from "./chat.js";

const token = document.querySelector('meta[name="ui-token"]').content;
const STATUS_LABELS = {
  idle: "idle",
  running: "running",
  waiting_permission: "waiting for you",
  done: "done",
  failed: "failed",
  stopped: "stopped",
};
const BASE_TITLE = "Orchestrator";
// a project's dot shows its most pressing session
const STATUS_URGENCY = ["waiting_permission", "running", "failed", "done", "stopped", "idle"];
const BUSY_STATUSES = ["running", "waiting_permission"];

let state = { projects: [], pending: [], permissionMode: "ask", speechMode: "questions", voiceInput: "idle" };
// empty: the orchestrator's own chat is selected
let selectedProject = localRead("selectedProject") ?? "";
const chat = new ChatView(token);
// true while the assistant writes its summary; the chat empties once that is saved
let clearingAssistant = false;

// ---------------------------------------------------------------- connection

function connect() {
  const events = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  events.onopen = () => setConnected(true);
  events.onerror = () => setConnected(false); // EventSource reconnects by itself
  events.addEventListener("state", (e) => renderState(JSON.parse(e.data)));
  events.addEventListener("backlog", (e) => chat.setOrchestratorBacklog(JSON.parse(e.data)));
  events.addEventListener("feed", (e) => receiveFeedEntry(JSON.parse(e.data)));
  events.addEventListener("chat", (e) => chat.addSessionMessage(JSON.parse(e.data)));
  events.addEventListener("chat_cleared", (e) => chat.clearSession(JSON.parse(e.data)));
}

function receiveFeedEntry(entry) {
  chat.addOrchestratorEntry(entry);
  if (entry.taskOutcome) flashNotice(`${entry.about} ${entry.taskOutcome}`, entry.taskOutcome);
}

const NOTICE_MS = 4000;

/** A brief corner notice, matching what's said aloud when a task ends. */
function flashNotice(text, outcome) {
  const notice = el("div", { class: `notice ${outcome}`, role: "status" }, text);
  document.body.append(notice);
  setTimeout(() => notice.remove(), NOTICE_MS);
}

function setConnected(live) {
  const dot = document.getElementById("connection");
  dot.classList.toggle("live", live);
  dot.title = live ? "Connected" : "Disconnected, retrying…";
}

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": token },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json.message;
}

async function act(path, body) {
  try {
    return await post(path, body);
  } catch (error) {
    alert(error.message);
  }
}

// ---------------------------------------------------------------- state

function renderState(next) {
  state = next;
  renderModes();
  renderVoiceInput();
  renderProjects();
  renderApprovals();
  renderConversation();
  renderDetail();
  document.title = state.pending.length ? `(${state.pending.length}) ${BASE_TITLE}` : BASE_TITLE;
}

const VOICE_INPUT_NOTICE = {
  recording: "Listening…",
  held: "Holding your message a moment in case you keep talking…",
};

function renderVoiceInput() {
  const notice = document.getElementById("voice-status");
  notice.hidden = state.voiceInput === "idle";
  notice.textContent = VOICE_INPUT_NOTICE[state.voiceInput] ?? "";
}

function renderModes() {
  markSegment("permission-mode", state.permissionMode);
  markSegment("speech-mode", state.speechMode);
}

function markSegment(id, value) {
  for (const button of document.getElementById(id).querySelectorAll("button"))
    button.setAttribute("aria-checked", String(button.dataset.value === value));
}

function selected() {
  return state.projects.find((p) => p.name === selectedProject);
}

function activeSession(project) {
  return project.sessions.find((s) => s.id === project.activeSession);
}

function selectProject(name) {
  selectedProject = name;
  localWrite("selectedProject", name);
  renderProjects();
  renderConversation();
  renderDetail();
}

// ---------------------------------------------------------------- projects

function renderProjects() {
  const list = document.getElementById("project-list");
  const projects = state.projects.length
    ? state.projects.map((p) => el("li", {}, projectCard(p)))
    : [el("li", { class: "empty" }, "No projects yet. Ask the assistant to open one.")];
  list.replaceChildren(...projects);
  document.getElementById("assistant-entry").replaceChildren(assistantCard());
}

/** The main chat with the orchestrator. Always there: it can be cleared, never closed. */
function assistantCard() {
  const open = el("button", { type: "button", class: "assistant-open" },
    el("span", { class: "assistant-name" }, "Assistant"),
    el("span", { class: "assistant-meta" }, "Main chat"));
  open.addEventListener("click", () => selectProject(""));
  const clear = button(clearingAssistant ? "Saving…" : "Clear", "ghost assistant-clear", clearAssistant);
  clear.title = "Clear the assistant's chat; it first saves a short summary of what mattered";
  clear.disabled = clearingAssistant;
  return el("div", { class: `assistant${selected() ? "" : " selected"}` }, open, clear);
}

async function clearAssistant() {
  if (!confirm("Clear the assistant's chat? It first saves a short summary and key facts, then deletes the messages. Projects and their sessions are kept."))
    return;
  setClearingAssistant(true);
  await act("/api/assistant/clear");
  setClearingAssistant(false);
}

function setClearingAssistant(clearing) {
  clearingAssistant = clearing;
  renderProjects();
}

function projectCard(project) {
  const status = projectStatus(project);
  const sessionCount = project.sessions.length > 1 ? el("span", { class: "badge" }, `${project.sessions.length} sessions`) : "";
  const card = el("button", { class: `project${project.name === selectedProject ? " selected" : ""}` },
    el("div", { class: "project-head" },
      el("span", { class: `dot ${status}`, title: STATUS_LABELS[status] }),
      el("span", { class: "project-name" }, project.name),
      sessionCount,
      el("span", { class: "badge" }, project.profile)),
    el("div", { class: "project-meta" }, sessionSubtitle(activeSession(project))));
  card.addEventListener("click", () => selectProject(project.name));
  return card;
}

function projectStatus(project) {
  return STATUS_URGENCY.find((status) => project.sessions.some((s) => s.status === status)) ?? "idle";
}

function sessionSubtitle(session) {
  if (session.status === "running" && session.lastActivity) return `now: ${session.lastActivity}`;
  const queued = session.queued.length ? ` · ${session.queued.length} queued` : "";
  return `${STATUS_LABELS[session.status]}${queued}`;
}

// ---------------------------------------------------------------- approvals

function renderApprovals() {
  const section = document.getElementById("approvals");
  section.hidden = !state.pending.length;
  document.getElementById("approval-list").replaceChildren(...state.pending.map(approvalCard));
}

function approvalCard(request) {
  const destructive = Boolean(request.destructiveVerb);
  const actions = destructive
    ? [button(`Allow ${request.destructiveVerb}…`, "danger", () => confirmDestructive(request)), button("Deny", "", () => answer(request.id, "deny"))]
    : [
        button("Allow once", "primary", () => answer(request.id, "once")),
        button("Always", "", () => answer(request.id, "always")),
        button("Deny", "", () => answer(request.id, "deny")),
      ];
  return el("div", { class: `approval${destructive ? " destructive" : ""}` },
    el("div", { class: "approval-head" },
      el("strong", {}, request.label),
      el("span", { class: "muted" }, destructive ? `destructive · ${request.destructiveVerb}` : "wants to run"),
      el("span", { class: "muted" }, `· ${timeAgo(request.createdAt)}`)),
    ...explanationOf(request),
    el("pre", { class: "command" }, request.description),
    el("div", { class: "approval-actions" }, ...actions));
}

/** Plain words above a destructive command: what it does and how risky it is. */
function explanationOf(request) {
  if (request.explanation) return [el("p", { class: "explanation" }, request.explanation)];
  if (request.explaining) return [el("p", { class: "explanation muted" }, "Explaining what this does…")];
  return [];
}

function answer(id, decision) {
  return act(`/api/permissions/${id}`, { decision });
}

function confirmDestructive(request) {
  const dialog = document.getElementById("confirm-dialog");
  document.getElementById("confirm-title").textContent = `Allow ${request.destructiveVerb}?`;
  document.getElementById("confirm-project").textContent = `${request.label} wants to run:`;
  document.getElementById("confirm-explanation").textContent = request.explanation ?? "";
  document.getElementById("confirm-command").textContent = request.description;
  dialog.returnValue = "";
  dialog.onclose = () => {
    if (dialog.returnValue === "confirm") answer(request.id, "once");
  };
  dialog.showModal();
  document.querySelector("#confirm-dialog .ghost").focus(); // Enter must not approve by accident
}

// ---------------------------------------------------------------- conversation (center)

/** The center shows the assistant's chat, or the selected project's active session with its tabs. */
function renderConversation() {
  const project = selected();
  const tabs = document.getElementById("session-tabs");
  const input = document.getElementById("composer-input");
  tabs.hidden = !project;
  if (!project) {
    input.placeholder = "Message the assistant…";
    return chat.showOrchestrator();
  }
  const session = activeSession(project);
  input.placeholder = `Task for ${project.name} · session ${session.number}…`;
  tabs.replaceChildren(...sessionTabs(project), button("+", "ghost session-new", () => createSession(project)));
  tabs.lastChild.title = `New session in ${project.name}`;
  chat.showSession(session.id);
}

function sessionTabs(project) {
  return project.sessions.map((session) => {
    const active = session.id === project.activeSession;
    const open = el("button", { type: "button", class: "session-open", title: sessionTitle(session) },
      el("span", { class: `dot ${session.status}`, title: STATUS_LABELS[session.status] }),
      el("span", { class: "session-name" }, `Session ${session.number}`),
      el("span", { class: "session-title" }, sessionTitle(session)));
    open.addEventListener("click", () => {
      if (!active) act(`/api/sessions/${session.id}/activate`);
    });
    const close = button("×", "ghost session-close", () => closeSession(session));
    close.title = `Close session ${session.number}`;
    close.setAttribute("aria-label", `Close session ${session.number}`);
    return el("div", { class: `session-tab${active ? " active" : ""}`, role: "tab", "aria-selected": String(active) }, open, close);
  });
}

/** Like a VS Code tab: named after what the session is about. */
function sessionTitle(session) {
  return session.task ?? session.history[0]?.task ?? "new";
}

function createSession(project) {
  return act(`/api/projects/${encodeURIComponent(project.name)}/sessions`);
}

function closeSession(session) {
  const busy = BUSY_STATUSES.includes(session.status);
  const warning = `Close session ${session.number}?${busy ? " Its worker will be stopped." : ""} Its messages, queue and history are deleted.`;
  if (confirm(warning)) act(`/api/sessions/${session.id}/close`);
}

function clearSession(session) {
  const busy = BUSY_STATUSES.includes(session.status);
  const warning = `Clear session ${session.number}?${busy ? " Its worker will be stopped." : ""} Its messages, history and worker conversation are deleted; the session stays open.`;
  if (confirm(warning)) act(`/api/sessions/${session.id}/clear`);
}

function sendMessage(event) {
  event.preventDefault();
  const input = document.getElementById("composer-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  autoGrow(input);
  const project = selected();
  if (project) act(`/api/sessions/${project.activeSession}/tasks`, { instruction: text });
  else act("/api/message", { text });
}

// ---------------------------------------------------------------- detail panel

function renderDetail() {
  const panel = document.getElementById("detail");
  const project = selected();
  if (!project) {
    delete panel.dataset.version;
    return panel.replaceChildren(el("p", { class: "empty" }, "Select a project to chat with its sessions and see their history."));
  }
  const session = activeSession(project);
  // rebuild only when there is something new, so open details survive live updates
  const version = `${session.id}#${session.history.length}`;
  if (panel.dataset.version === version) return updateDetailHead(project, session);
  panel.dataset.version = version;
  panel.replaceChildren(detailHead(project, session), historySection(session));
}

function detailHead(project, session) {
  return el("div", { class: "detail-head", id: "detail-head" }, ...detailHeadContent(project, session));
}

function updateDetailHead(project, session) {
  document.getElementById("detail-head")?.replaceChildren(...detailHeadContent(project, session));
}

function detailHeadContent(project, session) {
  const stop = button("Stop", "ghost", () => act(`/api/sessions/${session.id}/stop`));
  stop.disabled = !BUSY_STATUSES.includes(session.status);
  const clear = button("Clear session", "ghost", () => clearSession(session));
  clear.title = "Delete this session's messages, history and worker conversation, keeping the session open";
  const lines = [
    el("div", { class: "detail-title" },
      el("span", { class: `dot ${session.status}` }),
      el("h2", {}, `${project.name} · session ${session.number}`),
      el("span", { class: "badge" }, `${project.profile} account`)),
    el("div", { class: "section-row" },
      el("span", { class: "muted" }, `${STATUS_LABELS[session.status]} · $${session.costUsd.toFixed(2)} spent`),
      el("span", { class: "row-actions" }, stop, clear)),
  ];
  if (session.task && BUSY_STATUSES.includes(session.status))
    lines.push(el("div", {}, el("span", { class: "muted" }, "Task: "), session.task));
  if (session.status === "failed" && session.lastError) lines.push(el("div", { class: "outcome failed" }, session.lastError));
  return lines;
}

function historySection(session) {
  const items = [...session.history].reverse().map((h) =>
    el("li", { class: "history-item" },
      el("div", { class: "entry-meta" }, el("span", { class: `outcome ${h.outcome}` }, h.outcome), el("span", {}, formatTime(h.finishedAt))),
      el("div", { class: "history-task" }, h.task),
      collapsible("Result", h.result)));
  return el("div", { class: "detail-section" },
    el("h3", { class: "section-title" }, "History"),
    items.length ? el("ol", { class: "history" }, ...items) : el("p", { class: "muted" }, "No finished tasks yet."));
}

// ---------------------------------------------------------------- wiring

function wireSegment(id, path) {
  document.getElementById(id).addEventListener("click", (e) => {
    const value = e.target.closest("button")?.dataset.value;
    if (value) act(path, { mode: value });
  });
}

function wireComposer() {
  const form = document.getElementById("composer");
  const input = document.getElementById("composer-input");
  form.addEventListener("submit", sendMessage);
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

wireSegment("permission-mode", "/api/permission-mode");
wireSegment("speech-mode", "/api/speech-mode");
wireComposer();
connect();
