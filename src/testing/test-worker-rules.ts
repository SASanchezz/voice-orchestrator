import { DEFAULT_PROTECTED_BRANCHES } from "../config/app-config.js";
import { BranchScopedRules } from "../permissions/branch-scoped-rules.js";
import { BranchProtection } from "../safety/branch-protection.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import { GitBranches } from "../safety/git-branches.js";

/** The rules as workers see them, with the default protected branches. */
export function workerRules(destructive: DestructiveList): BranchScopedRules {
  return new BranchScopedRules(destructive, new BranchProtection(DEFAULT_PROTECTED_BRANCHES, new GitBranches()));
}
