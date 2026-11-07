/** Read-only user scopes for DMs, group DMs, names and mention search. */
const DIRECT_SCOPES = ["im:read", "im:history", "mpim:read", "mpim:history", "users:read", "search:read"];
/** Only asked for when channels are named in config. */
const CHANNEL_SCOPES = ["channels:read", "channels:history", "groups:read", "groups:history"];
const NEW_APP_URL = "https://api.slack.com/apps";
const APP_NAME = "Voice Orchestrator (read-only)";

/** The fewest scopes the reader needs for this workspace's settings. */
export function scopesFor(channelNames: string[]): string[] {
  return channelNames.length ? [...DIRECT_SCOPES, ...CHANNEL_SCOPES] : DIRECT_SCOPES;
}

/** Opens Slack's "create app" page with a manifest already filled in: an internal app with only user read scopes. */
export function newAppLink(scopes: string[]): string {
  const manifest = {
    display_information: { name: APP_NAME, description: "Reads your messages for spoken summaries. Never writes." },
    oauth_config: { scopes: { user: scopes } },
    settings: { org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false },
  };
  const query = new URLSearchParams({ new_app: "1", manifest_json: JSON.stringify(manifest) });
  return `${NEW_APP_URL}?${query.toString()}`;
}
