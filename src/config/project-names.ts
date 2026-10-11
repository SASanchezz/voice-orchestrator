import type { AppConfig } from "./app-config.js";

/** Loose project-name matching for speech ("web shop", "Webshop." -> webshop). */
export function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveProject(cfg: AppConfig, spoken: string): string | undefined {
  const want = normName(spoken);
  if (!want) return undefined;
  const names = Object.keys(cfg.projects);
  return (
    names.find((n) => normName(n) === want) ??
    names.find((n) => normName(n).startsWith(want) || want.startsWith(normName(n))) ??
    names.find((n) => normName(n).includes(want) || want.includes(normName(n)))
  );
}
