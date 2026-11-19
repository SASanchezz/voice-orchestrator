// Orchestrator UI entry point. Everything a worker or the model wrote is inserted as text, never as HTML.

import { openEvents, onServerEvent } from "./api.js";
import { store } from "./store.js";
import { ChatView } from "./chat.js";
import { renderIndicators, wireSegment, setConnected } from "./indicators.js";
import { renderProjectTabs, wireAssistantClear } from "./project-tabs.js";
import { renderQuestions } from "./questions.js";
import { renderConversation, wireComposer } from "./conversation.js";
import { renderCodeView } from "./code-view.js";
import { renderDetail } from "./detail.js";
import { followMicNews, isComposerIdle, renderMicButton, wireMicButton } from "./mic-button.js";
import { renderProjectTodo } from "./project-todo.js";
import { noteShownSession, wireSeenResults } from "./seen-results.js";
import { navigate, navigateFromLink } from "./navigation.js";
import { wirePageHistory } from "./page-history.js";
import { reloadIfRestarted, wireRestart } from "./restart.js";
import { renderEditorRestart, wireEditorRestart } from "./editor-restart.js";
import { wireMessengerSetup } from "./messenger-setup.js";
import { wireMessengerStatus } from "./messenger-status.js";
import { wireWakeTraining } from "./wake-training.js";
import { AttachmentTray } from "./attachments.js";
import { ByPathNotice } from "./by-path-notice.js";
import { BoxDrafts } from "./box-drafts.js";
import { byId } from "./dom.js";
import { reportDraft, reportDraftWhileShown } from "./draft-report.js";
import { reportShownSession, reportShownSessionChange, wireShownSessionReport } from "./shown-session-report.js";
import { reportFrontSession, reportFrontSessionChange, wireFrontSessionReport } from "./front-session-report.js";
import { reportPageUse, wirePageUseReport } from "./page-use-report.js";
import { wireImageViewer } from "./image-viewer.js";
import { renderVoiceOffer } from "./voice-offer.js";
import { wireFullScreenEscape } from "./full-screen-escape.js";
import { wireCloseKey } from "./close-key.js";
import { wireTodoDialog } from "./todo-dialog.js";
import { renderForceStop, wireForceStop } from "./force-stop.js";
import { renderBackgroundJobs, wireBackgroundJobs } from "./background-jobs.js";
import { wirePanelResize } from "./panel-resize.js";
import { wireChangePoll } from "./change-poll.js";
import { renderPlanUsage, wirePlanUsagePoll } from "./plan-usage.js";
import { showLatestReply, showLatestReplyOf, renderLatestReply } from "./latest-reply.js";
import { wireProjectLinks } from "./project-links.js";
import { renderReview, wireReview } from "./review.js";
import { renderMessages, wireMessages } from "./messages.js";
import { wireChatBrowser } from "./chat-browser.js";
import { wireReplyCheckup } from "./reply-checkup.js";
import { wireSessionClose } from "./session-close.js";
import { wireSessionMenu } from "./session-menu.js";
import { wireSessionPicker } from "./session-picker.js";
import { wireClosedSessionList } from "./closed-session-list.js";
import { renderViewMode, wireViewMode } from "./view-mode.js";

const chat = new ChatView();
const tray = new AttachmentTray(byId("attachment-list", HTMLElement), new ByPathNotice(), reportDraft);
const drafts = new BoxDrafts(byId("composer-input", HTMLTextAreaElement), isComposerIdle);

function renderPage(): void {
  noteShownSession(); // first, so the session on screen doesn't shine
  renderIndicators();
  renderProjectTabs();
  renderPlanUsage();
  renderQuestions();
  renderConversation(chat);
  drafts.render();
  renderProjectTodo();
  renderCodeView();
  renderViewMode();
  renderReview();
  renderMessages();
  renderForceStop();
  chat.showPendingApprovals(store.state.pending);
  renderDetail();
  renderVoiceOffer(tray);
  renderMicButton();
  renderLatestReply();
}

function connect(): void {
  const events = openEvents();
  events.addEventListener("open", () => setConnected(true));
  events.addEventListener("open", reloadIfRestarted);
  events.addEventListener("open", () => reportDraft(tray.count)); // a restarted server knows of no draft
  events.addEventListener("open", reportShownSession);
  events.addEventListener("open", reportFrontSession);
  events.addEventListener("open", reportPageUse); // a restarted server knows of no page
  events.addEventListener("error", () => setConnected(false)); // EventSource reconnects by itself
  followState(events);
  followChats(events);
  followMicNews(events);
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
store.onChange(reportShownSessionChange);
store.onChange(reportFrontSessionChange);
store.onChange(renderEditorRestart);
store.onChange(renderBackgroundJobs);
wireSegment("permission-mode", "/api/permission-mode");
wireSegment("speech-mode", "/api/speech-mode");
wireSegment("gesture-mode", "/api/gestures");
wireSegment("wake-word-mode", "/api/wake-word");
wireComposer(tray);
wireForceStop();
wireBackgroundJobs();
reportDraftWhileShown(() => tray.count);
wireShownSessionReport();
wireFrontSessionReport();
wireImageViewer();
wireSeenResults(renderPage);
wireMicButton(tray);
wirePageUseReport();
wireTodoDialog();
wireRestart();
wireEditorRestart();
wireMessengerSetup();
wireProjectLinks();
wireMessengerStatus();
wireWakeTraining();
wirePanelResize();
wireViewMode();
wireReview();
wireMessages();
wireChatBrowser();
wireReplyCheckup();
wireAssistantClear();
wireSessionClose();
wireSessionMenu();
wireSessionPicker();
wireClosedSessionList();
wireFullScreenEscape(); // after every other Escape handler
wireCloseKey();
wireChangePoll();
wirePlanUsagePoll();
wirePageHistory();
connect();
