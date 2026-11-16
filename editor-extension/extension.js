// Runs in the editor server's extension host, which is on this Mac, so Finder can be told to show the file.
const { execFile } = require("node:child_process");
const vscode = require("vscode");

function activate(context) {
  const command = vscode.commands.registerCommand("voiceOrchestrator.revealInFinder", revealInFinder);
  context.subscriptions.push(command);
}

/** The clicked file, or the open editor's file when run from the command palette. */
function revealInFinder(clicked) {
  const target = clicked ?? vscode.window.activeTextEditor?.document.uri;
  if (!target) return;
  execFile("open", ["-R", target.fsPath], (error) => {
    if (error) void vscode.window.showErrorMessage(`Couldn't reveal ${target.fsPath} in Finder: ${error.message}`);
  });
}

module.exports = { activate };
