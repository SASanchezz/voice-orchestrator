// A small stopwatch: a face whose hand goes round once a minute, and the time it has run beside it.

import { el } from "./dom.js";
import { elapsedSince, secondsSince } from "./elapsed.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const DEGREES_PER_SECOND = 6;
const SECONDS_PER_MINUTE = 60;

export function stopwatch(startedAt: number): HTMLSpanElement {
  const time = el("span", { class: "stopwatch-time" }, elapsedSince(startedAt));
  return el("span", { class: "stopwatch", title: "How long it has run" }, face(startedAt), time);
}

/** The hand points where a real stopwatch's second hand would. */
function face(startedAt: number): SVGSVGElement {
  const angle = (secondsSince(startedAt) % SECONDS_PER_MINUTE) * DEGREES_PER_SECOND;
  const svg = svgElement("svg", { class: "stopwatch-face", viewBox: "0 0 24 24", "aria-hidden": "true" });
  svg.append(
    svgElement("rect", { class: "stopwatch-crown", x: "10", y: "1", width: "4", height: "3", rx: "1" }),
    svgElement("circle", { class: "stopwatch-dial", cx: "12", cy: "14", r: "8.5" }),
    svgElement("line", {
      class: "stopwatch-hand",
      x1: "12",
      y1: "14",
      x2: "12",
      y2: "8",
      transform: `rotate(${angle} 12 14)`,
    }),
    svgElement("circle", { class: "stopwatch-pin", cx: "12", cy: "14", r: "1.3" }),
  );
  return svg;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}
