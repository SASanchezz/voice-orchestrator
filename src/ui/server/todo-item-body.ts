import { z } from "zod";

const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 4000;

/** An item as the page's form sends it; project "" means none. */
export const todoItemBody = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
  description: z.string().trim().max(MAX_DESCRIPTION_CHARS),
  project: z.string(),
});
export type TodoItemBody = z.infer<typeof todoItemBody>;

export const todoDoneBody = z.object({ done: z.boolean() });
