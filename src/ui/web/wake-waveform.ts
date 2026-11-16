// A recording's waveform: one bar per slice of the clip, as loud as its peak, drawn in the canvas's text colour.

const BAR_GAP_PX = 1;
const MIN_BAR_PX = 1;
const HALF = 2;

/**
 * Bars are scaled to `loudest`, the loudest recording of its kind, so a quiet take looks quiet next to the others.
 * The canvas must be on the page already, to have a size.
 */
export function drawWaveform(canvas: HTMLCanvasElement, bars: number[], loudest: number): void {
  if (bars.length === 0) return;
  const pen = sizedPen(canvas);
  const { clientWidth: width, clientHeight: height } = canvas;
  const step = width / bars.length;
  pen.fillStyle = getComputedStyle(canvas).color;
  bars.forEach((bar, index) => drawBar(pen, { x: index * step, width: step, height }, bar / (loudest || 1)));
}

interface BarSlot {
  x: number;
  width: number;
  height: number;
}

function drawBar(pen: CanvasRenderingContext2D, slot: BarSlot, share: number): void {
  const barHeight = Math.max(MIN_BAR_PX, Math.min(1, share) * slot.height);
  const top = (slot.height - barHeight) / HALF;
  pen.fillRect(slot.x, top, Math.max(MIN_BAR_PX, slot.width - BAR_GAP_PX), barHeight);
}

/** Sharp on a Retina screen: as many canvas pixels as screen pixels. */
function sizedPen(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  const pen = canvas.getContext("2d");
  if (!pen) throw new Error("This browser can't draw a waveform.");
  pen.scale(ratio, ratio);
  return pen;
}
