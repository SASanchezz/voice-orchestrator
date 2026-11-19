// Back and forward through the places the page showed. Each place is a browser history entry, so Chrome's
// two-finger swipe, ⌘[ / ⌘] and a mouse's back button move through them.

import {
  isPlaceEntry,
  isPlaceOpen,
  isSamePlace,
  placeOf,
  type PagePlace,
  type PlaceScreen,
  type ShownScreen,
} from "../page-place.js";
import { act } from "./api.js";
import { store } from "./store.js";

/** Long enough for the server's state to show a session made active again; after it, places are recorded again. */
const RESTORE_WAIT_MS = 3000;
const BACK = -1;
const FORWARD = 1;

/** How far into the page's history the shown entry is; tells a back swipe from a forward one. */
let shownIndex = 0;
/** The place a swipe is bringing back; the page changes on the way there, and those steps aren't recorded. */
let restoring: PagePlace | undefined;
let restoreTimer: ReturnType<typeof setTimeout> | undefined;

export function wirePageHistory(): void {
  store.onChange(recordPlace);
  window.addEventListener("popstate", (event) => void showEntry(event));
}

/** A new place gets an entry of its own, which drops any forward entries, as a browser does. */
function recordPlace(): void {
  if (!isSelectionKnown()) return;
  const place = placeOf(shownScreen(), store.state.projects);
  if (restoring) return finishRestoringAt(place);
  const entry: unknown = history.state;
  if (!isPlaceEntry(entry)) return history.replaceState({ place, index: shownIndex }, "");
  shownIndex = entry.index; // a reloaded page starts on an entry the browser kept
  if (isSamePlace(entry.place, place)) return;
  shownIndex += 1;
  history.pushState({ place, index: shownIndex }, "");
}

/** Before the server's first state, a project remembered from last time isn't in the list yet. */
function isSelectionKnown(): boolean {
  return !store.selectedProjectName || store.selectedProject() !== undefined;
}

function shownScreen(): ShownScreen {
  return { project: store.selectedProjectName, screen: shownScreenName() };
}

function shownScreenName(): PlaceScreen {
  if (store.reviewShown) return "review";
  if (store.messagesShown) return "messages";
  if (store.projectTodoShown) return "todo";
  return "chat";
}

function finishRestoringAt(place: PagePlace): void {
  if (!restoring || !isSamePlace(restoring, place)) return;
  stopRestoring();
}

/** A place whose session or project was closed since is stepped over, in the swipe's direction. */
async function showEntry(event: PopStateEvent): Promise<void> {
  const entry: unknown = event.state;
  if (!isPlaceEntry(entry)) return;
  const direction = entry.index < shownIndex ? BACK : FORWARD;
  shownIndex = entry.index;
  if (isPlaceOpen(entry.place, store.state.projects)) return restore(entry.place);
  history.go(direction);
}

async function restore(place: PagePlace): Promise<void> {
  startRestoring(place);
  await activateSession(place);
  showScreen(place);
}

function startRestoring(place: PagePlace): void {
  stopRestoring();
  restoring = place;
  restoreTimer = setTimeout(stopRestoring, RESTORE_WAIT_MS);
}

function stopRestoring(): void {
  clearTimeout(restoreTimer);
  restoring = undefined;
}

/** The session becomes its project's active one again, so tasks go where you are looking. */
async function activateSession({ project, sessionId }: PagePlace): Promise<void> {
  const view = store.state.projects.find((known) => known.name === project);
  if (!sessionId || view?.activeSession === sessionId) return;
  await act(`/api/sessions/${sessionId}/activate`);
}

function showScreen({ project, screen }: PagePlace): void {
  store.select(project);
  if (screen === "review") return store.showReview();
  if (screen === "messages") return store.showMessages();
  store.hideReview();
  if (screen === "todo") store.showProjectTodo();
}
