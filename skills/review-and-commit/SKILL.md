---
name: review-and-commit
description: >-
  Has a project's worker review its uncommitted changes and commit them in small logical commits. Use when the user
  says "review and commit" for a project, or says it in other words, e.g. "review and commit webshop".
---

# Review and commit

The user wants a project's uncommitted changes reviewed and committed. The worker does it with its
voice-worker:review-and-commit skill; your part is to pick the session and set the user's expectations.

1. Settle the project with the routing rules; it works for any registered project. The phrase is the go-ahead, so
   don't wait for another once the project is certain.
2. Call list_sessions first. Sessions share the project's folder, so if any session of that project is busy, say so and
   ask whether to wait for it or commit now.
3. Send it to a new session unless the active session is idle and fresh, with exactly this instruction:
   "Operations: review and commit the uncommitted changes, using the voice-worker:review-and-commit skill."
4. Tell the user each commit will ask for "confirm commit", once per commit. That phrase is still needed every time.
   The skill never pushes; a push is a separate request.
