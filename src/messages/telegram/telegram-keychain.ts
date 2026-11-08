// Where the Telegram login keeps its secrets. Apart from the reader, so checking them doesn't load GramJS.

export const TELEGRAM_KEYCHAIN_SERVICE = "voice-orchestrator.telegram";
export const KEYCHAIN_ACCOUNTS = { apiId: "api-id", apiHash: "api-hash", session: "session" } as const;
