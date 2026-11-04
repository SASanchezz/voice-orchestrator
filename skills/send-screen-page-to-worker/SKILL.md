---
name: send-screen-page-to-worker
description: >-
  Passes the page or link the user is looking at to a project's worker. Use when the user asks to send, pass or give
  "this page", "this link" or "what I'm looking at" to a project, e.g. "send this page to webshop".
---

# Send the page on screen to a worker

The user wants a project's worker to use the page or link on their screen. Read its address from the screen, then
hand it to the worker in the project's current session.

1. Settle the project with the routing rules. If the user named no project and none is being talked about, ask which
   one.
2. Call look_at_screen. Find the address of the page they mean: the browser's address bar, or the link they point at
   or that stands out on the page. Copy it exactly, character by character, including the scheme (https://).
3. If no full address is readable (cut off, hidden, or not a browser), say so in one sentence and ask the user to
   paste the link into the web UI's chat. Never guess or rebuild an address.
4. Call run_task for that project, in its active session: don't call new_session for this, even if the session is
   busy; run_task queues it. Start the instruction with its task type, as the task-type rules say, then the user's
   request in their words, then the full address, e.g. "Analysis only, don't change any files: read this page and
   say how it affects the checkout: https://…".
5. Keep the requirement-clarity rules: a request that changes files still needs the user's go-ahead before run_task.
6. Confirm in one short sentence which project got the page. Never speak the address; put it after [SCREEN].
