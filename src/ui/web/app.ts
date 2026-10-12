// Orchestrator UI entry point. Everything a worker or the model wrote is inserted as text, never as HTML.

import { openEvents, onServerEvent } from "./api.js";
import { store } from "./store.js";
import { ChatView } from "./chat.js";
import { renderIndicators, wireSegment, setConnected } from "./indicators.js";
import { renderProjects } from "./projects.js";
import { renderApprovals } from "./approvals.js";
import { renderConversation, wireComposer } from "./conversation.js";
import { renderDetail } from "./detail.js";
import { navigate, navigateFromLink } from "./navigation.js";

const chat = new ChatView();

function renderPage(): void {
  renderIndicators();
  renderProjects();
  renderApprovals();
  renderConversation(chat);
  renderDetail();
}

function connect(): void {
  const events = openEvents();
  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("error", () => setConnected(false)); // EventSource reconnects by itself
  onServerEvent(events, "state", (state) => store.receive(state));
  onServerEvent(events, "backlog", (entries) => {
    chat.setOrchestratorBacklog(entries);
    navigateFromLink(chat); // the state came just before the backlog, so sessions are known
  });
  onServerEvent(events, "feed", (entry) => chat.addOrchestratorEntry(entry));
  onServerEvent(events, "chat", (line) => chat.addSessionMessage(line));
  onServerEvent(events, "chat_cleared", (sessionId) => chat.clearSession(sessionId));
  onServerEvent(events, "navigate", (target) => void navigate(target, chat));
}

store.onChange(renderPage);
wireSegment("permission-mode", "/api/permission-mode");
wireSegment("speech-mode", "/api/speech-mode");
wireComposer();
connect();
