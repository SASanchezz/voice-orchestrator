// Orchestrator UI entry point. Everything a worker or the model wrote is inserted as text, never as HTML.

import { openEvents, onServerEvent } from "./api.js";
import { store } from "./store.js";
import { ChatView } from "./chat.js";
import { renderIndicators, wireSegment, setConnected } from "./indicators.js";
import { renderProjects } from "./projects.js";
import { renderApprovals } from "./approvals.js";
import { renderQuestions } from "./questions.js";
import { renderConversation, wireComposer } from "./conversation.js";
import { renderCodeView } from "./code-view.js";
import { renderDetail } from "./detail.js";
import { navigate, navigateFromLink } from "./navigation.js";
import { reloadIfRestarted, wireRestart } from "./restart.js";
import { AttachmentTray } from "./attachments.js";
import { byId } from "./dom.js";
import { reportDraft, reportDraftWhileShown } from "./draft-report.js";
import { wireImageViewer } from "./image-viewer.js";
import { renderVoiceOffer } from "./voice-offer.js";
import { wireVoiceDiscard } from "./voice-discard.js";
import { wireTodoDialog } from "./todo-dialog.js";
import { renderForceStop, wireForceStop } from "./force-stop.js";

const chat = new ChatView();
const tray = new AttachmentTray(byId("attachment-list", HTMLElement), reportDraft);

function renderPage(): void {
  renderIndicators();
  renderProjects();
  renderApprovals();
  renderQuestions();
  renderConversation(chat);
  renderCodeView();
  renderForceStop();
  chat.showPendingApprovals(store.state.pending);
  renderDetail();
  renderVoiceOffer(tray);
}

function connect(): void {
  const events = openEvents();
  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("open", reloadIfRestarted);
  events.addEventListener("open", () => reportDraft(tray.count)); // a restarted server knows of no draft
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
wireSegment("gesture-mode", "/api/gestures");
wireComposer(tray);
wireForceStop();
reportDraftWhileShown(() => tray.count);
wireImageViewer();
wireVoiceDiscard();
wireTodoDialog();
wireRestart();
connect();
