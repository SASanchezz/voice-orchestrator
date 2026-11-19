import type { z } from "zod";
import { nextCursorOf } from "./slack-api.js";
import type { SlackCalls, SlackParams } from "./slack-client.js";

/** What every paged Slack list response carries. */
type PagedResponse = Parameters<typeof nextCursorOf>[0];

/** A list method and its parameters, page size (`limit`) included. */
export interface SlackListRequest {
  method: string;
  params: SlackParams;
}

/** Every page of a paged list method, in Slack's order. */
export async function everyPage<Schema extends z.ZodType<PagedResponse>>(
  client: SlackCalls,
  { method, params }: SlackListRequest,
  schema: Schema,
): Promise<z.infer<Schema>[]> {
  const pages: z.infer<Schema>[] = [];
  let cursor = "";
  do {
    const page = await client.call(method, { ...params, cursor }, schema);
    pages.push(page);
    cursor = nextCursorOf(page);
  } while (cursor);
  return pages;
}
