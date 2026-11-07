---
name: use-clipboard
description: >-
  Reads what the user copied (a screenshot or other image, a link or text, or files copied in Finder) and analyses it,
  or passes it to a project's worker for analysis. Use when the user mentions their clipboard or what they copied,
  e.g. "read it from the clipboard", "what did I copy?", "analyse the screenshot I copied", "send what I copied to
  webshop".
---

# Use what the user copied

The user wants you, or a project's worker, to look at what they copied. Read it only now, because they asked; never
read the clipboard otherwise.

1. Call read_clipboard.
2. If it says the clipboard holds nothing, tell the user in one sentence, including the hint about macOS refusing the
   read if it gave one, and ask them to copy it again or paste it into the web UI's chat. Stop there.
3. If the user named no project and none is being talked about, answer them yourself from what was copied: describe
   only what answers their question, and never read the text or the image out in full. If what they want needs a
   project's code (e.g. "why does this error happen in webshop?"), settle the project with the routing rules, asking
   which one if it is unclear, and go on to step 4.
4. For a project, call run_task in its active session: don't call new_session for this, even if the session is busy;
   run_task queues it. Unless the user asked for changes, the task is analysis: start the instruction with "Analysis
   only, don't change any files:", then the user's request in their words, then what was copied:
   - an image: its saved path, saying it is an image the user copied, e.g. "the screenshot the user copied:
     /…/state/attachments/…/clipboard.png";
   - a link or short text: the text exactly, character by character; never shorten or rebuild an address;
   - long text: its saved path, saying it is text the user copied;
   - files copied in Finder: each path, saying what it is if the name shows it.
5. If the user asked for changes, keep the requirement-clarity rules: say back what you understood and wait for their
   go-ahead before run_task, with the task type the task-type rules give.
6. Confirm in one short sentence which project got it. Never speak paths or addresses aloud; put them after [SCREEN].
