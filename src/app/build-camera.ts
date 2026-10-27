import type { CameraSource } from "../camera/camera-source.js";
import { LlamaDescriber } from "../camera/llama-describer.js";
import { ANSWER_ALOUD, DESCRIBE_FOR_ASSISTANT } from "../camera/vision-prompts.js";
import type { CameraSettings } from "../config/camera-config.js";
import { CameraShortcut } from "../orchestrator/conversation/camera-shortcut.js";
import type { TurnTaker, UserTurnTaker } from "../orchestrator/conversation/turn-taker.js";
import { DescribedView, PictureView, type CameraView } from "../orchestrator/tools/camera-views.js";

/** `camera.describer` decides who looks at the frames: Claude, or a local vision model that tells Claude about them. */
export function cameraView(settings: CameraSettings, camera: CameraSource): CameraView {
  if (settings.describer === "claude") return new PictureView(camera);
  return new DescribedView(camera, new LlamaDescriber(settings.visionServer, fetch, DESCRIBE_FOR_ASSISTANT));
}

/** With a local vision model, quick camera questions are answered by it alone; with Claude describing, nothing changes. */
export function userTurnTaker(settings: CameraSettings, camera: CameraSource, turns: TurnTaker): UserTurnTaker {
  if (settings.describer === "claude") return turns;
  return new CameraShortcut(camera, new LlamaDescriber(settings.visionServer, fetch, ANSWER_ALOUD), turns);
}
