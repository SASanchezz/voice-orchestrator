// Which of a search picker's options match what you typed. Every word you type must appear somewhere in the option, in
// any order and case, so "fe login" finds "wicked-fe · feature/login". Options whose name starts with what you typed
// come first. No imports, so the page bundles it and Node tests it.

export interface PickerOption {
  /** What picking it hands back. */
  value: string;
  label: string;
  /** Shown muted beside the label, and searched too: a branch, a file count. */
  detail: string;
}

export function matchingOptions(options: PickerOption[], query: string): PickerOption[] {
  const words = searchWordsOf(query);
  const matching = options.filter((option) => hasEveryWord(searchTextOf(option), words));
  const prefix = query.trim().toLowerCase();
  return matching.toSorted((one, other) => startRank(one, prefix) - startRank(other, prefix));
}

/** Whether every word of the query appears in `text`; an empty query matches everything. */
export function matchesQuery(text: string, query: string): boolean {
  return hasEveryWord(text.toLowerCase(), searchWordsOf(query));
}

function searchWordsOf(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function hasEveryWord(text: string, words: string[]): boolean {
  return words.every((word) => text.includes(word));
}

function searchTextOf({ label, detail }: PickerOption): string {
  return `${label} ${detail}`.toLowerCase();
}

/** 0 for an option whose label starts with the query, 1 for the rest, so a sort keeps their order otherwise. */
function startRank({ label }: PickerOption, prefix: string): number {
  return label.toLowerCase().startsWith(prefix) ? 0 : 1;
}
