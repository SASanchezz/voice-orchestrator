// How wide a panel the user resizes by dragging may be, and reading a width the browser remembered.

export const MIN_PANEL_WIDTH_PX = 160;
export const MAX_PANEL_WIDTH_PX = 900;

/** A whole number of pixels within the limits, so no panel can be dragged away or over the whole page. */
export function clampPanelWidth(width: number): number {
  return Math.round(Math.min(MAX_PANEL_WIDTH_PX, Math.max(MIN_PANEL_WIDTH_PX, width)));
}

/** A width saved earlier, kept within the limits; undefined when nothing usable was saved. */
export function parsePanelWidth(saved: string | undefined): number | undefined {
  const width = Number(saved);
  const isUsable = saved !== undefined && saved.trim() !== "" && Number.isFinite(width);
  return isUsable ? clampPanelWidth(width) : undefined;
}
