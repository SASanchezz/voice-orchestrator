import { z } from "zod";

/** ⌥Space is taken by some input sources, so the quick panel also holds Control. */
export const DEFAULT_QUICK_PANEL_HOTKEY = "ctrl+option+space";
const MODIFIER = "(cmd|command|ctrl|control|option|alt|shift)";
const KEY = "([a-z0-9]|space|return|tab)";
/** One or more modifiers and one key, e.g. "ctrl+option+space" or "cmd+shift+k"; native/shared/key-combo.swift reads it. */
const KEY_COMBO = new RegExp(`^(${MODIFIER}\\+)+${KEY}$`);
const KEY_COMBO_HINT = 'Write it as modifiers and one key joined by "+", like "ctrl+option+space" or "cmd+shift+k".';

/** The key combo that brings up the quick panel from any app; empty in YAML, it gets the default. */
export const quickPanelHotkeySchema = z.preprocess(
  (value) => value ?? undefined,
  z.string().trim().toLowerCase().regex(KEY_COMBO, KEY_COMBO_HINT).default(DEFAULT_QUICK_PANEL_HOTKEY),
);
