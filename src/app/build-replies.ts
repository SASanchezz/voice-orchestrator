import { resolve } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import type { AppConfig } from "../config/app-config.js";
import type { SlackWorkspaceSettings, TelegramSettings } from "../config/messages-config.js";
import { STATE_DIR } from "../config/paths.js";
import { ChatRules } from "../messages/replies/chat-rules.js";
import { ConversationReaders, type ConversationReader } from "../messages/replies/conversation-reading.js";
import { DraftNews } from "../messages/replies/draft-news.js";
import { DraftingSwitch, SwitchedDraftRequests } from "../messages/replies/drafting-switch.js";
import type { ReplyCheckup } from "../messages/replies/reply-checkup.js";
import { CountedInbox, RecordedDrafts, ReplyHealth } from "../messages/replies/reply-health.js";
import { DraftStore } from "../messages/replies/draft-store.js";
import { DraftViews } from "../messages/replies/draft-views.js";
import type { InboundFeed, InboundSink } from "../messages/replies/inbound.js";
import { InboundFeeds } from "../messages/replies/inbound-feeds.js";
import { MessengerPrefill } from "../messages/replies/messenger-prefill.js";
import { ReplyChannels, type ReplyChannel } from "../messages/replies/reply-channel.js";
import { ReplyDesk } from "../messages/replies/reply-desk.js";
import { ReplyDrafter } from "../messages/replies/reply-drafter.js";
import { ReplyInbox, type DraftRequests } from "../messages/replies/reply-inbox.js";
import { SpokenSend } from "../messages/replies/spoken-send.js";
import { ToolFreeModel } from "../messages/replies/tool-free-model.js";
import { SlackConversationReader } from "../messages/slack/slack-conversation-reader.js";
import { SlackReplyChannel } from "../messages/slack/slack-reply-channel.js";
import { TelegramConversationReader } from "../messages/telegram/telegram-conversation-reader.js";
import { TelegramLiveFeed } from "../messages/telegram/telegram-live-feed.js";
import { TelegramReplyChannel } from "../messages/telegram/telegram-reply-channel.js";
import { DraftingActions } from "../ui/server/drafting-actions.js";
import { ReplyActions } from "../ui/server/reply-actions.js";
import type { MessengerLinks } from "./build-messages.js";
import { replyCheckup } from "./build-reply-checkup.js";
import { slackLiveFeeds } from "./build-slack-feeds.js";

const MESSAGES_DIR = resolve(STATE_DIR, "messages");

/** The sources with `send: true`: only they get live feeds, drafts and sending. */
interface SendingSources {
  slack: SlackWorkspaceSettings[];
  telegram?: TelegramSettings;
}

/** Drafted replies: the live feeds that start them, the page's buttons, and "confirm send" by voice. */
export interface ReplyParts {
  feeds: InboundFeeds;
  actions: ReplyActions;
  spoken: SpokenSend;
  /** What the Messages view lists and reads. */
  views: DraftViews;
  /** Each new draft, for the small pop-up. */
  news: DraftNews;
  rules: ChatRules;
  /** The Messages view's Check setup. */
  checkup: ReplyCheckup;
  /** Whether new messages are drafted, as the Messages view reads it. */
  drafting: DraftingSwitch;
  /** The Messages view's Drafting switch, which turns it off and on again. */
  toggle: DraftingActions;
}

/** What drafting and "confirm send" use from the app: Claude, and the voice that says how sending went. */
export interface ReplyDevices {
  query: QueryFn;
  voice: { speak(text: string): Promise<void> };
}

/** With no source sending, the feeds are empty and nothing runs in the background. */
export function buildReplies(cfg: AppConfig, links: MessengerLinks, devices: ReplyDevices): ReplyParts {
  const sources = sendingSources(cfg);
  const drafts = new DraftStore(resolve(MESSAGES_DIR, "drafts.json"));
  const desk = replyDesk(drafts, replyChannels(sources, links));
  const conversations = readers(sources, links);
  const news = new DraftNews(desk);
  const rules = new ChatRules(resolve(MESSAGES_DIR, "chat-rules.json"));
  const health = new ReplyHealth();
  const outcomes = new RecordedDrafts(news, health);
  const drafter = new ReplyDrafter(conversations, new ToolFreeModel(cfg, devices.query), outcomes);
  const drafting = new DraftingSwitch(resolve(MESSAGES_DIR, "drafting.json"));
  const inbox = new CountedInbox(replyInbox(new SwitchedDraftRequests(drafting, drafter), rules), health);
  const live = [...slackLiveFeeds(sources.slack, links, inbox), ...telegramFeeds(sources, links, inbox)];
  const spoken = new SpokenSend(desk, (text) => void devices.voice.speak(text));
  const views = new DraftViews(drafts, conversations);
  const checkup = replyCheckup(cfg.messages, links, health);
  const actions = new ReplyActions(desk, spoken);
  const toggle = new DraftingActions(drafting);
  return { feeds: new InboundFeeds(live, health), actions, spoken, views, news, rules, checkup, drafting, toggle };
}

function replyDesk(drafts: DraftStore, channels: ReplyChannels): ReplyDesk {
  return new ReplyDesk(drafts, channels, new MessengerPrefill(channels));
}

function sendingSources({ messages }: AppConfig): SendingSources {
  const telegram = messages.telegram?.send ? messages.telegram : undefined;
  return { slack: messages.slack.filter((workspace) => workspace.send), telegram };
}

function replyInbox(drafter: DraftRequests, rules: ChatRules): ReplyInbox {
  return new ReplyInbox(rules, drafter, (run, ms) => void setTimeout(run, ms));
}

function readers({ slack, telegram }: SendingSources, links: MessengerLinks): ConversationReaders {
  const entries = slack.map((workspace): [string, ConversationReader] => [
    `slack:${workspace.workspace}`,
    new SlackConversationReader(workspace, links.openSlack),
  ]);
  if (telegram) entries.push(["telegram", new TelegramConversationReader(telegram, links.openTelegram)]);
  return new ConversationReaders(new Map(entries));
}

function replyChannels({ slack, telegram }: SendingSources, links: MessengerLinks): ReplyChannels {
  const entries = slack.map((workspace): [string, ReplyChannel] => [
    `slack:${workspace.workspace}`,
    new SlackReplyChannel(workspace.workspace, links.openSlack),
  ]);
  if (telegram) entries.push(["telegram", new TelegramReplyChannel(links.openTelegram)]);
  return new ReplyChannels(new Map(entries));
}

function telegramFeeds({ telegram }: SendingSources, links: MessengerLinks, inbox: InboundSink): InboundFeed[] {
  return telegram ? [new TelegramLiveFeed(telegram, links.openTelegram, inbox)] : [];
}
