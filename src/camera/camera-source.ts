import type { Screenshot } from "../screen/screen-source.js";

/** A camera frame, shaped like a screenshot: a base64 JPEG. */
export type CameraFrame = Screenshot;

/** Snaps the camera when you start talking, and hands that frame over when the model asks for it. */
export interface CameraSource {
  capture(): void;
  latest(): Promise<CameraFrame>;
  /** The turns that could look at the frames taken before `time` are over, so their files can go. */
  releaseShotsBefore(time: number): void;
}
