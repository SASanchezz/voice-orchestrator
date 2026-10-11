/** The message of anything thrown, for logs and spoken replies. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
