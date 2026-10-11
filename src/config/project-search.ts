import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { AppConfig } from "./app-config.js";
import { normName } from "./project-names.js";

const SKIPPED_FOLDERS = new Set([
  "node_modules",
  "Library",
  "Applications",
  "Music",
  "Movies",
  "Pictures",
  "Public",
  "VirtualBox VMs",
  "go",
  "dist",
  "build",
]);
const DEFAULT_DEPTH = 3;
const MAX_MATCHES = 5;
const EXACT_MATCH_SCORE = 3;
const PREFIX_MATCH_SCORE = 2;
const PARTIAL_MATCH_SCORE = 1;
const MIN_PARTIAL_MATCH_LENGTH = 4;
const GIT_REPO_BONUS = 0.5;

/**
 * Find project folders by spoken name under searchRoots (depth 3).
 * Matches "database admin" -> dbadmin via normalized names and initials+rest.
 */
export function findProjectDirs(cfg: AppConfig, spoken: string, maxDepth = DEFAULT_DEPTH): string[] {
  const search = new FolderSearch(nameVariants(spoken), maxDepth);
  for (const root of cfg.searchRoots) search.walk(root, 1);
  return search.bestMatches();
}

/** "database admin" -> also "dadmin" (initials of all but the last word, then the last) and "dbadmin". */
function nameVariants(spoken: string): Set<string> {
  const words = spoken
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const variants = new Set([normName(spoken)]);
  if (words.length > 1) {
    const initials = words.slice(0, -1).map((word) => word[0]);
    variants.add(initials.join("") + words[words.length - 1]);
    variants.add(words.map((word) => (word === "database" ? "db" : word)).join(""));
  }
  return variants;
}

function matchScore(dir: string, variants: Set<string>): number {
  const name = normName(basename(dir));
  if (variants.has(name)) return EXACT_MATCH_SCORE;
  if ([...variants].some((v) => name.startsWith(v) || v.startsWith(name))) return PREFIX_MATCH_SCORE;
  if ([...variants].some((v) => v.length >= MIN_PARTIAL_MATCH_LENGTH && name.includes(v))) return PARTIAL_MATCH_SCORE;
  return 0;
}

/** Depth-first walk that collects scored folders; a git repository ranks above a plain folder with the same name. */
class FolderSearch {
  private hits: { dir: string; score: number }[] = [];
  private seen = new Set<string>();

  constructor(
    private variants: Set<string>,
    private maxDepth: number,
  ) {}

  walk(dir: string, depth: number): void {
    if (depth > this.maxDepth || this.seen.has(dir)) return;
    this.seen.add(dir);
    for (const child of subfolders(dir)) this.visit(child, depth);
  }

  bestMatches(): string[] {
    const ranked = this.hits.toSorted((a, b) => b.score - a.score);
    return [...new Map(ranked.map((hit) => [hit.dir, hit])).keys()].slice(0, MAX_MATCHES);
  }

  private visit(dir: string, depth: number): void {
    const score = matchScore(dir, this.variants);
    if (score) this.hits.push({ dir, score: score + (existsSync(join(dir, ".git")) ? GIT_REPO_BONUS : 0) });
    this.walk(dir, depth + 1);
  }
}

function subfolders(dir: string): string[] {
  return entriesOf(dir)
    .filter((name) => !name.startsWith(".") && !SKIPPED_FOLDERS.has(name))
    .map((name) => join(dir, name))
    .filter(isDirectory);
}

function entriesOf(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
