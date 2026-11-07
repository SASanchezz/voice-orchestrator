import type { FetchFn } from "../messages/slack/slack-client.js";

/** A canned answer to one Slack method: a body (sent with ok: true unless it says otherwise) or a whole Response. */
export type SlackRoute = (params: URLSearchParams) => object;

interface SlackCall {
  method: string;
  params: URLSearchParams;
  authorization: string;
}

/** A fetch that answers Slack API calls from canned routes and records each call; no network. */
export class FakeSlack {
  readonly calls: SlackCall[] = [];

  constructor(private routes: Record<string, SlackRoute>) {}

  readonly fetch: FetchFn = async (input, init) => {
    const method = urlOf(input).split("/api/")[1];
    const params = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
    this.calls.push({ method, params, authorization: new Headers(init?.headers).get("Authorization") ?? "" });
    return this.answer(method, params);
  };

  /** The calls to one method. */
  callsTo(method: string): URLSearchParams[] {
    return this.calls.filter((call) => call.method === method).map((call) => call.params);
  }

  private answer(method: string, params: URLSearchParams): Response {
    const route = this.routes[method];
    if (!route) return slackJson({ ok: false, error: "unknown_method" });
    const answer = route(params);
    return answer instanceof Response ? answer : slackJson({ ok: true, ...answer });
  }
}

function urlOf(input: string | URL | Request): string {
  if (input instanceof Request) return input.url;
  return input instanceof URL ? input.href : input;
}

function slackJson(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

export function rateLimited(retryAfterSeconds: number): Response {
  return new Response("", { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}
