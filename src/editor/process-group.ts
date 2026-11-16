import { execFileSync } from "node:child_process";
import { z } from "zod";

const psOutputSchema = z.string();

/** Stops the group the process leads, so what it started stops as well. */
export function stopGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // the group has already exited
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Whether the process runs a command line containing the text; pids are reused, so being alive doesn't say it. */
export function runsCommand(pid: number, text: string): boolean {
  try {
    return commandLineOf(pid).includes(text);
  } catch {
    return false;
  }
}

function commandLineOf(pid: number): string {
  const output: unknown = execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" });
  return psOutputSchema.parse(output);
}
