import { Keychain } from "../secrets/keychain.js";

const ITEM_NOT_FOUND_EXIT_CODE = 44;

/** A Keychain holding only the given secrets, by "service/account"; no real Keychain is touched. */
export function keychainHolding(secrets: Record<string, string>): Keychain {
  return new Keychain(async (_file, args) => {
    const secret = secrets[`${args[2]}/${args[4]}`];
    if (secret === undefined) throw Object.assign(new Error("not found"), { code: ITEM_NOT_FOUND_EXIT_CODE });
    return { stdout: `${secret}\n` };
  });
}
