// How to connect each messenger to catch-up, shown under ⚙ › Messengers. A new messenger is one more guide here.

/** One thing to do, with the command to run or the page to open, when there is one. */
export interface GuideStep {
  text: string;
  command?: string;
  link?: string;
}

export interface MessengerGuide {
  name: string;
  /** What the assistant reads from it, in a few words. */
  reads: string;
  steps: GuideStep[];
  /** Its part of the `messages` block in config/config.yaml, as the user would write it. */
  config: string;
}

/** The same four steps for every messenger; each guide fills in the details. */
export const COMMON_STEPS: string[] = [
  "In a terminal in the app's folder, run the messenger's login command. Secrets go in at a hidden prompt " +
    "and are kept in the macOS Keychain, never in a file or on this page.",
  "Add the messenger under messages: in config/config.yaml. Its profile is the Claude account that " +
    "summarizes it and must be one of your profiles: give work chats your work account.",
  "Restart the app (⚙ › Restart).",
  'Say "catch me up on my messages". Say it again straight away: it should say nothing is new. ' +
    '"What message sources are set up?" lists what it reads.',
];

/** The full guide, with how to replace or revoke access. */
export const SETUP_DOC = "docs/messages-setup.md";

export const MESSENGER_GUIDES: MessengerGuide[] = [
  {
    name: "Slack",
    reads: "DMs, group DMs, mentions, and only the channels you name",
    steps: [
      {
        text:
          "Pick a short name for the workspace (letters, digits, dots, dashes), e.g. acme. To read channels too, " +
          "add the workspace to config with its channels first, so the login asks for channel access.",
      },
      { text: "Run the login with that name:", command: "npm run slack-login -- acme" },
      {
        text:
          "On the Slack page it opens, pick the workspace, then Next › Create, then Install to Workspace › Allow. " +
          "Some workspaces need an admin to approve the app.",
      },
      {
        text:
          "Under OAuth & Permissions, copy the User OAuth Token (it starts with xoxp-) and paste it at the " +
          "prompt. It checks the token with Slack before saving it. Your Slack apps are listed at",
        link: "https://api.slack.com/apps",
      },
    ],
    config: ["messages:", "  slack:", "    - workspace: acme", "      profile: work", "      channels: []"].join("\n"),
  },
  {
    name: "Telegram",
    reads: "every chat with new messages, or only the chats you name",
    steps: [
      {
        text: "Sign in, open API development tools and create an app (any name and platform). Keep its api_id and api_hash.",
        link: "https://my.telegram.org",
      },
      { text: "Run the login:", command: "npm run telegram-login" },
      {
        text:
          "Enter the api_id and api_hash. Then scan the QR code it shows: on your phone, Telegram › Settings › " +
          "Devices › Link Desktop Device. No SMS code is needed. Last, your two-step verification password, if " +
          "you have one.",
      },
      {
        text:
          "In config, chats: all sends every new message, groups and channels too, to the summarizer. " +
          "A list of chat names, e.g. [Family, Bob], keeps it to those; exclude skips chats.",
      },
    ],
    config: ["messages:", "  telegram:", "    profile: personal", "    chats: all", "    exclude: []"].join("\n"),
  },
];
