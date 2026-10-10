import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { z } from "zod";
import { APP_DIR, STATE_DIR, type AppConfig } from "../config.js";
import type { Registry } from "../registry.js";
import type { WorkerManager } from "../workers.js";
import type { PermissionBroker } from "../permissions.js";
import type { Orchestrator } from "../orchestrator.js";
import type { Feed, FeedEntry } from "./feed.js";
import type { SessionChats } from "../chats.js";

const PUBLIC_DIR = resolve(APP_DIR, "src/ui/public");
const STATIC_FILES: Record<string, string> = {
  "/app.js": "text/javascript",
  "/chat.js": "text/javascript",
  "/dom.js": "text/javascript",
  "/app.css": "text/css",
};
const TOKEN_PLACEHOLDER = "__UI_TOKEN__";
const STATE_PUSH_MS = 500;
const HEARTBEAT_MS = 15_000;
const MAX_BODY_BYTES = 64 * 1024;
const SESSION_MESSAGES_PATH = /^\/api\/sessions\/([\w-]+)\/messages$/;

const messageBody = z.object({ text: z.string().trim().min(1) });
const decisionBody = z.object({ decision: z.enum(["once", "always", "deny"]) });
const permissionModeBody = z.object({ mode: z.enum(["auto", "ask"]) });
const speechModeBody = z.object({ mode: z.enum(["all", "questions", "muted"]) });
const taskBody = z.object({ instruction: z.string().trim().min(1) });

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Route = (body: unknown, match: RegExpMatchArray) => string | Promise<string>;

/**
 * Local web UI: live state over server-sent events, actions over POST.
 * Bound to 127.0.0.1; every API call needs the token from the printed link, so other
 * websites open in your browser can't drive it, and the Host check blocks DNS rebinding.
 */
export class UiServer {
  private server?: Server;
  private clients = new Set<ServerResponse>();
  private lastState = "";
  private token = loadToken();
  private port = 0;
  private routes: [RegExp, Route][] = [
    [/^\/api\/message$/, (b) => this.sendMessage(b)],
    [/^\/api\/assistant\/clear$/, () => this.clearAssistant()],
    [/^\/api\/permissions\/(\w+)$/, (b, m) => this.answerPermission(m[1], b)],
    [/^\/api\/permission-mode$/, (b) => this.broker.setMode(permissionModeBody.parse(b).mode)],
    [/^\/api\/speech-mode$/, (b) => this.setSpeechMode(b)],
    [/^\/api\/projects\/([^/]+)\/sessions$/, (_b, m) => this.createSession(decodeURIComponent(m[1]))],
    [/^\/api\/sessions\/([\w-]+)\/activate$/, (_b, m) => this.activateSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/close$/, (_b, m) => this.closeSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/clear$/, (_b, m) => this.clearSession(m[1])],
    [/^\/api\/sessions\/([\w-]+)\/tasks$/, (b, m) => this.runTask(m[1], b)],
    [/^\/api\/sessions\/([\w-]+)\/stop$/, (_b, m) => this.stopTask(m[1])],
  ];

  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private workers: WorkerManager,
    private broker: PermissionBroker,
    private orchestrator: Orchestrator,
    private feed: Feed,
    private chats: SessionChats,
  ) {}

  /** Starts listening; resolves with the link to open (it carries the token). */
  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((ok, fail) => {
      this.server!.once("error", fail);
      this.server!.listen(this.cfg.ui.port, "127.0.0.1", () => ok());
    });
    this.port = (this.server.address() as AddressInfo).port;
    this.feed.on("entry", (e: FeedEntry) => this.broadcast("feed", e));
    this.feed.on("cleared", () => this.broadcast("backlog", []));
    this.chats.on("message", (m: unknown) => this.broadcast("chat", m));
    this.chats.on("cleared", (sessionId: string) => this.broadcast("chat_cleared", sessionId));
    setInterval(() => this.pushStateIfChanged(), STATE_PUSH_MS).unref();
    setInterval(() => this.clients.forEach((c) => c.write(": ping\n\n")), HEARTBEAT_MS).unref();
    return `http://127.0.0.1:${this.port}/?token=${this.token}`;
  }

  stop() {
    this.clients.forEach((c) => c.end());
    this.server?.close();
  }

  // ---------------------------------------------------------------- http

  private async handle(req: IncomingMessage, res: ServerResponse) {
    try {
      if (!this.isLocalHost(req.headers.host)) throw new HttpError(403, "Unexpected host");
      const url = new URL(req.url ?? "/", "http://local");
      if (req.method === "GET") return this.serveGet(url, res);
      if (req.method === "POST") return await this.servePost(url, req, res);
      throw new HttpError(405, "Method not allowed");
    } catch (e) {
      this.sendError(res, e);
    }
  }

  private serveGet(url: URL, res: ServerResponse) {
    if (url.pathname === "/") return this.servePage(url, res);
    if (url.pathname === "/api/events") return this.openEventStream(url, res);
    const sessionMessages = url.pathname.match(SESSION_MESSAGES_PATH);
    if (sessionMessages) return this.serveSessionMessages(url, sessionMessages[1], res);
    const type = STATIC_FILES[url.pathname];
    if (!type) throw new HttpError(404, "Not found");
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(readFileSync(resolve(PUBLIC_DIR, url.pathname.slice(1))));
  }

  private servePage(url: URL, res: ServerResponse) {
    if (!this.isToken(url.searchParams.get("token")))
      throw new HttpError(401, "Open the link printed in the terminal (it carries an access token).");
    const html = readFileSync(resolve(PUBLIC_DIR, "index.html"), "utf8").replace(TOKEN_PLACEHOLDER, this.token);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  }

  private openEventStream(url: URL, res: ServerResponse) {
    if (!this.isToken(url.searchParams.get("token"))) throw new HttpError(401, "Bad token");
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
    this.write(res, "state", this.state());
    this.write(res, "backlog", this.feed.recent());
  }

  private serveSessionMessages(url: URL, sessionId: string, res: ServerResponse) {
    if (!this.isToken(url.searchParams.get("token"))) throw new HttpError(401, "Bad token");
    this.requireSession(sessionId);
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(this.chats.messagesOf(sessionId)));
  }

  private async servePost(url: URL, req: IncomingMessage, res: ServerResponse) {
    if (!this.isToken(req.headers["x-token"])) throw new HttpError(401, "Bad token");
    const route = this.routes.map(([re, fn]) => [url.pathname.match(re), fn] as const).find(([m]) => m);
    if (!route) throw new HttpError(404, "Not found");
    const message = await route[1](await readJson(req), route[0]!);
    this.pushStateIfChanged();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ message }));
  }

  private sendError(res: ServerResponse, e: unknown) {
    const status = e instanceof HttpError ? e.status : e instanceof z.ZodError ? 400 : 500;
    const message = e instanceof z.ZodError ? "Invalid request" : e instanceof Error ? e.message : String(e);
    if (!res.headersSent) res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }

  // ---------------------------------------------------------------- actions

  private sendMessage(body: unknown): string {
    this.orchestrator.receiveTyped(messageBody.parse(body).text);
    return "Sent.";
  }

  /** The summary is saved before the visible chat goes, so nothing worth keeping is lost if saving fails. */
  private async clearAssistant(): Promise<string> {
    await this.orchestrator.clearConversation();
    this.feed.clear();
    return "Assistant chat cleared; a short summary is kept.";
  }

  private answerPermission(id: string, body: unknown): string {
    const about = this.broker.requests().find((r) => r.id === id)?.label;
    const message = this.broker.answerByClick(id, decisionBody.parse(body).decision);
    this.feed.add({ kind: "action", about, text: message });
    this.orchestrator.noteUiAction(`${message} (request ${id})`);
    return message;
  }

  private setSpeechMode(body: unknown): string {
    const { mode } = speechModeBody.parse(body);
    this.orchestrator.setSpeechMode(mode);
    return `Speech: ${mode}.`;
  }

  private runTask(sessionId: string, body: unknown): string {
    this.requireSession(sessionId);
    const { instruction } = taskBody.parse(body);
    const about = this.registry.labelOf(sessionId);
    const message = this.workers.runInSession(sessionId, instruction);
    this.feed.add({ kind: "action", about, text: `Task sent: ${instruction}`, detail: message });
    this.orchestrator.noteUiAction(`Sent ${about} a task: ${instruction}`);
    return message;
  }

  private stopTask(sessionId: string): string {
    this.requireSession(sessionId);
    const about = this.registry.labelOf(sessionId);
    return this.reportAction(about, this.workers.stopSession(sessionId));
  }

  private createSession(project: string): string {
    this.requireProject(project);
    const session = this.registry.createSession(project);
    return this.reportAction(project, `Opened ${project} session ${session.number}; it is now active.`);
  }

  private activateSession(sessionId: string): string {
    this.requireSession(sessionId);
    this.registry.activate(sessionId);
    const { project, number } = this.registry.session(sessionId);
    return this.reportAction(project, `${project} session ${number} is now active.`);
  }

  private async closeSession(sessionId: string): Promise<string> {
    this.requireSession(sessionId);
    const { project } = this.registry.session(sessionId);
    return this.reportAction(project, await this.workers.closeSession(sessionId));
  }

  private async clearSession(sessionId: string): Promise<string> {
    this.requireSession(sessionId);
    const { project } = this.registry.session(sessionId);
    return this.reportAction(project, await this.workers.clearSession(sessionId));
  }

  /** Shows a click's outcome in the feed and tells the model about it. */
  private reportAction(about: string, message: string): string {
    this.feed.add({ kind: "action", about, text: message });
    this.orchestrator.noteUiAction(message);
    return message;
  }

  private requireProject(name: string) {
    if (!this.registry.all().some((p) => p.name === name)) throw new HttpError(404, `No project ${name}`);
  }

  private requireSession(id: string) {
    if (!this.registry.hasSession(id)) throw new HttpError(404, `No session ${id}`);
  }

  // ---------------------------------------------------------------- live state

  private state() {
    return {
      projects: this.registry.all().map((p) => ({ ...p, sessions: this.registry.sessionsOf(p.name) })),
      pending: this.broker.requests(),
      permissionMode: this.broker.permissionMode,
      speechMode: this.orchestrator.speechMode,
      voiceInput: this.orchestrator.voiceInput,
    };
  }

  private pushStateIfChanged() {
    const state = JSON.stringify(this.state());
    if (state === this.lastState) return;
    this.lastState = state;
    this.clients.forEach((c) => c.write(`event: state\ndata: ${state}\n\n`));
  }

  private broadcast(event: string, payload: unknown) {
    this.clients.forEach((c) => this.write(c, event, payload));
  }

  private write(res: ServerResponse, event: string, payload: unknown) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  // ---------------------------------------------------------------- access

  private isLocalHost(host: string | undefined): boolean {
    return host === `127.0.0.1:${this.port}` || host === `localhost:${this.port}`;
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
  const token = randomBytes(24).toString("hex");
  writeFileSync(file, token, { mode: 0o600 });
  return token;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
}
