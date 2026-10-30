/**
 * The user's claude.ai connectors other than Google Calendar. Not being allowed only stops the operator calling them;
 * blocking them also keeps their tool definitions (about 100k tokens) out of every request it sends.
 * A connector added to the account later loads until it is listed here.
 */
const BLOCKED_CONNECTORS = [
  "Gmail",
  "Google_Drive",
  "Google_Docs",
  "Google_Sheets",
  "Google_Slides",
  "Claude_Docs",
  "Interactive_Brokers_IBKR",
  "Asana",
  "Slack",
  "Atlassian_MCP",
];

export const BLOCKED_CONNECTOR_TOOLS = BLOCKED_CONNECTORS.map((name) => `mcp__claude_ai_${name}__*`);
