import type { TodoItem } from "./todo-item-schema.js";

const ITEM_NUMBER = /^#?(\d+)$/;

/** The item meant: its number ("3" or "#3") or words from its title or description; an error to read out otherwise. */
export function pickTodoItem<Item extends TodoItem>(items: Item[], meant: string): Item {
  const number = meant.trim().match(ITEM_NUMBER)?.[1];
  if (number) return byNumber(items, Number(number));
  if (!meant.trim()) throw new Error("Say which to-do item: its number or words from it.");
  return byWords(items, meant);
}

/** "#3 Fix the footer (webshop)" */
export function todoItemLabel(item: TodoItem): string {
  const project = item.project ? ` (${item.project})` : "";
  return `#${item.id} ${item.title}${project}`;
}

function byNumber<Item extends TodoItem>(items: Item[], id: number): Item {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`There is no to-do item #${id}.`);
  return item;
}

function byWords<Item extends TodoItem>(items: Item[], words: string): Item {
  const matches = items.filter((item) => mentions(item, words));
  const [only] = matches;
  if (matches.length === 1 && only) return only;
  if (!matches.length) throw new Error(`No to-do item mentions "${words}".`);
  const open = matches.filter((item) => !item.done);
  const [onlyOpen] = open;
  if (open.length === 1 && onlyOpen) return onlyOpen; // a finished namesake rarely is the one meant
  throw new Error(`Several to-do items mention "${words}": ${matches.map(todoItemLabel).join("; ")}. Which one?`);
}

function mentions(item: TodoItem, words: string): boolean {
  const wanted = words.trim().toLowerCase();
  return `${item.title}\n${item.description}`.toLowerCase().includes(wanted);
}
