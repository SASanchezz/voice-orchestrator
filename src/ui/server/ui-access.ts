import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../../config/paths.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

const TOKEN_BYTES = 24;
const TOKEN_PLACEHOLDER = "__UI_TOKEN__";

/**
 * Bound to 127.0.0.1; every API call needs the token from the printed link, so other websites open
 * in your browser can't drive the UI, and the Host check blocks DNS rebinding.
 */
export class UiAccess {
  private token = loadToken();
  private port = 0;

  listeningOn(port: number): void {
    this.port = port;
  }

  /** The link to open; it carries the token. */
  link(): string {
    return `http://127.0.0.1:${this.port}/?token=${this.token}`;
  }

  isLocalHost(host: string | undefined): boolean {
    return host === `127.0.0.1:${this.port}` || host === `localhost:${this.port}`;
  }

  requireToken(candidate: string | string[] | null | undefined, refusal: string): void {
    if (!this.isToken(candidate)) throw new HttpError(HTTP_STATUS.unauthorized, refusal);
  }

  /** The page with the token in it, for its API calls. */
  withToken(html: string): string {
    return html.replace(TOKEN_PLACEHOLDER, this.token);
  }

  private isToken(candidate: string | string[] | null | undefined): boolean {
    if (typeof candidate !== "string" || candidate.length !== this.token.length) return false;
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(this.token));
  }
}

/** Kept across restarts so an open tab keeps working. */
function loadToken(): string {
  const file = resolve(STATE_DIR, "ui-token");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(STATE_DIR, { recursive: true });
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  writeFileSync(file, token, { mode: 0o600 });
  return token;
}
