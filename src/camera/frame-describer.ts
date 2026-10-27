import type { CameraFrame } from "./camera-source.js";

/** Turns a camera frame into words, so the frame itself never has to leave the machine. */
export interface FrameDescriber {
  /** A description of the frame that answers `question`, the user's words. */
  describe(frame: CameraFrame, question: string): Promise<string>;
}
