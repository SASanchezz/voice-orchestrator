import type { ServerResponse } from "node:http";
import { z } from "zod";
import { errorMessage } from "../../shared/errors.js";

export const HTTP_STATUS = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  conflict: 409,
  tooLarge: 413,
  serverError: 500,
} as const;

/** A refusal with its HTTP status; the page shows its message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function sendError(res: ServerResponse, e: unknown): void {
  const status = statusOf(e);
  const message = e instanceof z.ZodError ? "Invalid request" : errorMessage(e);
  if (!res.headersSent) res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

function statusOf(e: unknown): number {
  if (e instanceof HttpError) return e.status;
  return e instanceof z.ZodError ? HTTP_STATUS.badRequest : HTTP_STATUS.serverError;
}
