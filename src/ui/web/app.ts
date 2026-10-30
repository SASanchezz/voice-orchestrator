// Orchestrator UI entry point. Everything a worker or the model wrote is inserted as text, never as HTML.

import { openEvents, onServerEvent } from "./api.js";
import { store } from "./store.js";
import { ChatView } from "./chat.js";
import { renderIndicators, wireSegment, setConnected } from "./indicators.js";
import { renderProjectTabs, wireAssistantClear } from "./project-tabs.js";
import { renderApprovals } from "./approvals.js";
import { renderQuestions } from "./questions.js";
import { renderConversation, wireComposer } from "./conversation.js";
import { renderCodeView } from "./code-view.js";
import { renderDetail } from "./detail.js";
import { renderMicButton, showDictatedWords, wireMicButton } from "./mic-button.js";
import { renderProjectTodo } from "./project-todo.js";
import { noteShownSession, wireSeenResults } from "./seen-results.js";
import { renderVoiceDraft, showVoiceDraft } from "./voice-draft.js";
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
import { wirePanelResize } from "./panel-resize.js";
import { wireChangePoll } from "./change-poll.js";
import { renderPlanUsage, wirePlanUsagePoll } from "./plan-usage.js";
import { showLatestReply, showLatestReplyOf, renderLatestReply } from "./latest-reply.js";
import { renderReview, wireReview } from "./review.js";
import { wireSessionClose } from "./session-close.js";
import { renderViewMode, wireViewMode } from "./view-mode.js";

const chat = new ChatView();
const tray = new AttachmentTray(byId("attachment-list", HTMLElement), reportDraft);

function renderPage(): void {
  noteShownSession(); // first, so the session on screen doesn't shine
  renderIndicators();
  renderProjectTabs();
  renderPlanUsage();
  renderApprovals();
  renderQuestions();
  renderConversation(chat);
  renderProjectTodo();
  renderCodeView();
  renderViewMode();
  renderReview();
  renderForceStop();
  chat.showPendingApprovals(store.state.pending);
  renderDetail();
  renderVoiceOffer(tray);
  renderMicButton();
  renderVoiceDraft();
  renderLatestReply();
}

function connect(): void {
  const events = openEvents();
  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("open", reloadIfRestarted);
  events.addEventListener("open", () => reportDraft(tray.count)); // a restarted server knows of no draft
  events.addEventListener("error", () => setConnected(false)); // EventSource reconnects by itself
  followState(events);
  followChats(events);
  onServerEvent(events, "dictation", showDictatedWords);
  onServerEvent(events, "voice_draft", showVoiceDraft);
  onServerEvent(events, "navigate", (target) => void navigate(target, chat));
}

function followState(events: EventSource): void {
  onServerEvent(events, "state", (state) => store.receive(state));
  onServerEvent(events, "backlog", (entries) => {
    chat.setOrchestratorBacklog(entries);
    showLatestReplyOf(entries);
    navigateFromLink(chat); // the state came just before the backlog, so sessions are known
  });
}

function followChats(events: EventSource): void {
  onServerEvent(events, "feed", (entry) => {
    chat.addOrchestratorEntry(entry);
    showLatestReply(entry);
  });
  onServerEvent(events, "chat", (line) => chat.addSessionMessage(line));
  onServerEvent(events, "chat_cleared", (sessionId) => chat.clearSession(sessionId));
}

store.onChange(renderPage);
wireSegment("permission-mode", "/api/permission-mode");
wireSegment("speech-mode", "/api/speech-mode");
wireSegment("gesture-mode", "/api/gestures");
wireComposer(tray);
wireForceStop();
reportDraftWhileShown(() => tray.count);
wireImageViewer();
wireSeenResults(renderPage);
wireMicButton(); // before wireVoiceDiscard: Esc discards the recording first
wireVoiceDiscard();
wireTodoDialog();
wireRestart();
wirePanelResize();
wireViewMode();
wireReview();
wireAssistantClear();
wireSessionClose();
wireChangePoll();
wirePlanUsagePoll();
connect();
