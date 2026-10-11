import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { buildNativeHelper } from "../macos/native-helper.js";

const INPUT_MONITORING_EXIT_CODE = 2;

/** macOS virtual keycodes. A key without a side means its left one. */
const MAC_KEYCODES: Record<string, number> = {
  alt: 58,
  altleft: 58,
  altright: 61,
  meta: 55,
  metaleft: 55,
  metaright: 54,
  ctrl: 59,
  ctrlleft: 59,
  ctrlright: 62,
  shift: 56,
  shiftleft: 56,
  shiftright: 60,
  fn: 63,
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
  f13: 105,
  f14: 107,
  f15: 113,
  f16: 106,
  f17: 64,
  f18: 79,
  f19: 80,
  f20: 90,
};

const SYNONYMS: Record<string, string> = {
  option: "alt",
  opt: "alt",
  cmd: "meta",
  command: "meta",
  control: "ctrl",
  ctl: "ctrl",
};

/** Turn a friendly key name ("RIGHT ALT", "right option", "Right Cmd", "F13") into a macOS keycode. */
export function macKeycode(name: string): number {
  const words = name
    .toLowerCase()
    .split(/[\s_+-]+/)
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w);
  const side = words.find((w) => w === "left" || w === "right") ?? "";
  const key = words.filter((w) => w !== side).join("") + side;
  const keycode = MAC_KEYCODES[key];
  if (keycode === undefined) throw new Error(`Unknown hotkey "${name}". Examples: "RIGHT ALT", "RIGHT CMD", "F13".`);
  return keycode;
}

/**
 * Watches one key through a small Swift helper. Node can't host a macOS event tap itself:
 * native hooks that wait on the main dispatch queue freeze after the first key, since Node never runs that queue.
 */
export class MacHotkey {
  constructor(readonly keyName: string) {}

  async start(onDown: () => void, onUp: () => void): Promise<void> {
    const helper = await buildNativeHelper("hotkey");
    const child = spawn(helper, [String(macKeycode(this.keyName))], { stdio: ["pipe", "pipe", "inherit"] });
    process.once("exit", () => child.kill());
    const lines = createInterface({ input: child.stdout });
    await new Promise<void>((ready, fail) => {
      child.on("exit", (code) => {
        onUp(); // a helper that dies mid-press would otherwise leave the mic on
        if (code === INPUT_MONITORING_EXIT_CODE) reportMissingPermission();
        fail(new Error(`The hotkey helper stopped (exit code ${code}).`));
      });
      lines.on("line", (line) => {
        if (line === "ready") ready();
        else if (line === "down") onDown();
        else onUp();
      });
    });
  }
}

function reportMissingPermission(): never {
  console.error(
    "\nThe hotkey needs Input Monitoring permission for your terminal app (Terminal, iTerm, VS Code…).\n" +
      "  System Settings > Privacy & Security > Input Monitoring: turn it on, then fully quit and reopen the terminal.\n" +
      "  Or run without the hotkey: npm run start:text",
  );
  process.exit(1);
}
