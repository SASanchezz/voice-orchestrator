// A place the web UI showed, so a back or forward swipe can show it again.
// No runtime imports, so the page bundles it and Node tests it.

import type { ProjectView } from "./protocol.js";

/** chat: the session's chat (or the assistant's); todo: the project's To-do tab; review: the Review view. */
export type PlaceScreen = "chat" | "todo" | "review";

export interface PagePlace {
  /** Empty: the assistant's chat. */
  project: string;
  /** The session whose chat showed; empty on the assistant's chat, To-do and Review, which show no one session. */
  sessionId: string;
  screen: PlaceScreen;
}

/** What the page shows: its selected project (empty for the assistant) and screen. */
export interface ShownScreen {
  project: string;
  screen: PlaceScreen;
}

const NO_SESSION = "";

/** The place on screen; a project's session chat is the one its active session shows. */
export function placeOf(shown: ShownScreen, projects: ProjectView[]): PagePlace {
  const project = projects.find((known) => known.name === shown.project);
  const showsSessionChat = project !== undefined && shown.screen === "chat";
  const sessionId = showsSessionChat ? project.activeSession : NO_SESSION;
  return { project: shown.project, sessionId, screen: shown.screen };
}

export function isSamePlace(first: PagePlace, second: PagePlace): boolean {
  const isSameProject = first.project === second.project && first.sessionId === second.sessionId;
  return isSameProject && first.screen === second.screen;
}

/** The assistant is always there; a project's place needs the project, and its session if it names one. */
export function isPlaceOpen(place: PagePlace, projects: ProjectView[]): boolean {
  if (!place.project) return true;
  const project = projects.find((known) => known.name === place.project);
  if (!project) return false;
  return !place.sessionId || project.sessions.some((session) => session.id === place.sessionId);
}

/** A browser history entry of the page: the place, and how far into the page's history it is. */
export interface PlaceEntry {
  place: PagePlace;
  index: number;
}

/** The browser's history may hold anything another page or an older version of this one left there. */
export function isPlaceEntry(value: unknown): value is PlaceEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("index" in value) || !("place" in value)) return false;
  return typeof value.index === "number" && isPagePlace(value.place);
}

function isPagePlace(value: unknown): value is PagePlace {
  if (typeof value !== "object" || value === null) return false;
  if (!("project" in value) || !("sessionId" in value) || !("screen" in value)) return false;
  const hasNames = typeof value.project === "string" && typeof value.sessionId === "string";
  return hasNames && isPlaceScreen(value.screen);
}

function isPlaceScreen(value: unknown): value is PlaceScreen {
  return value === "chat" || value === "todo" || value === "review";
}
