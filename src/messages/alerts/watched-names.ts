import { isNamed } from "../chat-names.js";

/** The chats whose names are under `notify`, matched like config names elsewhere (case and punctuation ignored). */
export function watchedAmong<Chat>(chats: Chat[], notify: string[], nameOf: (chat: Chat) => string): Chat[] {
  return chats.filter((chat) => notify.some((name) => isNamed(nameOf(chat), name)));
}

/** The `notify` names no chat matched, e.g. a typo or a chat the catch-up doesn't read. */
export function unmatchedNames(notify: string[], watchedNames: string[]): string[] {
  return notify.filter((name) => !watchedNames.some((watched) => isNamed(watched, name)));
}

/** Logs what is watched, by count, and every name that matched nothing, so a typo doesn't fail silently. */
export function logWatched(source: string, watchedNames: string[], notify: string[]): void {
  console.log(`[messages] ${source}: announcing new messages in ${watchedNames.length} chats`);
  for (const name of unmatchedNames(notify, watchedNames))
    console.warn(`[messages] ${source}: no chat named "${name}" among those read, so it isn't announced`);
}
