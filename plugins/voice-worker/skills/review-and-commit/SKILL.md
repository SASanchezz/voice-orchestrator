---
name: review-and-commit
description: >-
  Reviews the project's uncommitted changes, splits them into logical groups, and makes one commit per group with a
  short message. Use when the user or the voice assistant says "review and commit". Never pushes.
---

# Review and commit

Turn the uncommitted changes in this project into a few small, logical commits on the current branch. A person is
listening by voice and approves each commit, so keep the commits few and every message easy to judge.

## Rules

- Work on the current branch. Don't create or switch branches.
- Never push, rebase, amend, stash, or discard anything, and don't use `--no-verify`.
- Don't edit any file. A problem you find is reported, not fixed.
- Run one `git commit` per Bash command, with nothing else in that command, so each approval covers exactly one commit.
- Add no AI or Claude attribution to commit messages.

## 1. Check the state

Run `git status --short --branch`.

- Not a git repository, or nothing to commit: say so and stop.
- A merge, rebase, cherry-pick or unresolved conflict in progress: say so and stop.

## 2. Review the changes

Read `git diff HEAD`, and read untracked files too. Decide what must stay out of the commits:

- Secret files (`.env`, keys, credentials, tokens). Judge these by name and don't open them.
- Files with conflict markers, or with credentials written into the code.
- Debug leftovers, scratch files, and generated output that doesn't belong in the repository.

Keep the other findings, such as likely bugs, for the closing note. They don't block a commit.

## 3. Split into groups

Each group is one change that can be described in a single line: a feature, a fix, a refactor, docs. Put a test with
the code it tests. Order the groups so that later commits build on earlier ones.

Group by whole files. A file with unrelated changes goes in the group that fits most of it; mention that in the closing
note.

## 4. Write the messages

Read `git log --oneline -10` and match its style. Each message is one imperative line of at most 72 characters that
says what changed, with no body.

## 5. Commit each group

1. Run `git reset -q` once, so that nothing staged earlier ends up in the wrong commit. This leaves file contents as
   they are.
2. For each group, in order:
   1. Run `git add -- <the group's paths>`, naming the paths one by one.
   2. Run `git commit -m "<message>"` on its own.

If a commit is denied or fails, including through a hook, stop there. Run `git reset -q` so that nothing stays staged,
and don't try another way.

## 6. Close

End with a short plain-language note: how many commits you made and each message, what you left out and why, any review
findings, and what is still uncommitted. Say that nothing was pushed.
