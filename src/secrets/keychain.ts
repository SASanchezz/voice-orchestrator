import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Runs a program with arguments and gives back what it printed; tests pass a fake. */
export type CommandRunner = (file: string, args: string[]) => Promise<{ stdout: string }>;

const SECURITY_BIN = "/usr/bin/security";
/** `security` exits with this when there is no such item. */
const ITEM_NOT_FOUND_EXIT_CODE = 44;

/** The macOS login Keychain's generic passwords, read with `security`; a value is returned, never logged. */
export class Keychain {
  constructor(private run: CommandRunner) {}

  async read(service: string, account: string): Promise<string> {
    const stdout = await this.passwordOutput(service, account);
    const secret = stdout.replace(/\n$/, "");
    if (!secret) throw new Error(`The Keychain item ${itemName(service, account)} is empty.`);
    return secret;
  }

  /** Whether the item exists; its value isn't read. */
  async has(service: string, account: string): Promise<boolean> {
    try {
      await this.run(SECURITY_BIN, ["find-generic-password", "-s", service, "-a", account]);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw keychainError(error, service, account);
    }
  }

  private async passwordOutput(service: string, account: string): Promise<string> {
    try {
      const { stdout } = await this.run(SECURITY_BIN, ["find-generic-password", "-s", service, "-a", account, "-w"]);
      return stdout;
    } catch (error) {
      throw keychainError(error, service, account);
    }
  }
}

/** The real runner: `security` through execFile, so no shell sees the arguments. */
export function keychainOnThisMac(): Keychain {
  const run = promisify(execFile);
  return new Keychain(async (file, args) => run(file, args, { encoding: "utf8" }));
}

/** Says which item is missing and how to add it; the command's own output is left out, as it may hold the value. */
function keychainError(error: unknown, service: string, account: string): Error {
  const name = itemName(service, account);
  if (!isNotFound(error)) return new Error(`Couldn't read the Keychain item ${name}.`);
  const add = `security add-generic-password -s ${service} -a ${account} -w`;
  return new Error(`No Keychain item ${name}. Add it with: ${add}`);
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === ITEM_NOT_FOUND_EXIT_CODE;
}

function itemName(service: string, account: string): string {
  return `"${service}" (account "${account}")`;
}
