import { z } from "zod";
import { GESTURE_MODES } from "../../sensors/gesture-setting.js";
import type { GestureControl } from "../../sensors/gesture-switch.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

/** The same switch as the web UI's Gestures control, so both always agree. */
export function setGestures(gestures: GestureControl): OperatorTool {
  return defineTool({
    name: "set_gestures",
    description:
      "Turn camera gestures on or off, e.g. 'turn on gestures', 'enable gestures', 'disable gestures'. Off stops the " +
      "camera completely, so look_at_camera and its local vision model don't work until it is on again. " +
      "Remembered across restarts. Say only the result, e.g. 'Gestures on.'",
    args: { mode: z.enum(GESTURE_MODES) },
    run: ({ mode }) => text(gestures.setMode(mode)),
  });
}
