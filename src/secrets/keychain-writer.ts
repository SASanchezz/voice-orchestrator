import { spawn } from "node:child_process";

/** Runs a program, writes `input` to its stdin, and resolves when it exits successfully; tests pass a fake. */
export type StdinRunner = (file: string, args: string[], input: string) => Promise<void>;

const SECURITY_BIN = "/usr/bin/security";
/** Characters that need no quoting inside `security -i`'s double quotes. */
const SAFE_VALUE = /^[\w+/=.:-]+$/;

/**
 * Saves generic passwords with `security -i`, the command written on stdin, so the secret never appears in the
 * process list the way `security add-generic-password -w <secret>` would put it there.
 */
export class KeychainWriter {
  constructor(private run: StdinRunner) {}

  async save(service: string, account: string, secret: string): Promise<void> {
    await this.run(SECURITY_BIN, ["-i"], addPasswordCommand(service, account, secret));
  }
}

/** The command as `security -i` reads it; -U replaces an item that is already there. */
export function addPasswordCommand(service: string, account: string, secret: string): string {
  for (const value of [service, account, secret])
    if (!SAFE_VALUE.test(value)) throw new Error("A Keychain value has characters that can't be passed safely.");
  return `add-generic-password -U -s "${service}" -a "${account}" -w "${secret}"\n`;
}

export function keychainWriterOnThisMac(): KeychainWriter {
  return new KeychainWriter(runWithStdin);
}

/** security's own output is dropped: on failure it may echo the command, secret included. */
async function runWithStdin(file: string, args: string[], input: string): Promise<void> {
  const child = spawn(file, args, { stdio: ["pipe", "ignore", "ignore"] });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  child.stdin.end(input);
  const code = await exited;
  if (code !== 0) throw new Error(`${file} couldn't save the Keychain item (exit code ${String(code)}).`);
}
