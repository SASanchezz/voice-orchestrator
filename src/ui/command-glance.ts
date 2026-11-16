// A waiting command's short form for the approval card and the pop-up; the whole command is one click away.
// No runtime imports, so the page bundles it and Node tests it.

const GLANCE_CHARS = 160;

/** The command on one line, cut off with … past about three lines of the pop-up. */
export function commandGlance(command: string): string {
  const oneLine = command.replace(/\s+/g, " ").trim();
  return oneLine.length > GLANCE_CHARS ? `${oneLine.slice(0, GLANCE_CHARS)}…` : oneLine;
}

/** Whether the glance leaves something out, so the whole command is worth a toggle. */
export function isCutByGlance(command: string): boolean {
  return commandGlance(command) !== command.trim();
}
