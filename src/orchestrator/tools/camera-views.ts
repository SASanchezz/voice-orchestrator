import type { CameraSource } from "../../camera/camera-source.js";
import type { FrameDescriber } from "../../camera/frame-describer.js";
import { captioned, text, type ToolResult } from "./tool-kit.js";

const PICTURE_CAPTION = "The user's camera when they started speaking:";
const DESCRIBED_CAPTION = "A local vision model looked at the user's camera when they started speaking. It says:";
const PICTURE_HINT =
  "It can miss details or misread text. If this doesn't answer the user, call look_at_camera with picture: true.";

/** How look_at_camera shows the model the user's camera. */
export interface CameraView {
  /** What the camera shows, as far as the user's question needs. */
  describe(question: string): Promise<ToolResult>;
  /** The frame itself. */
  picture(): Promise<ToolResult>;
}

/** Claude sees the frame itself, whatever the question. */
export class PictureView implements CameraView {
  constructor(protected camera: CameraSource) {}

  describe(_question: string): Promise<ToolResult> {
    return this.picture();
  }

  async picture(): Promise<ToolResult> {
    return captioned(PICTURE_CAPTION, await this.camera.latest());
  }
}

/** A local model's words about the frame; the frame goes to Claude only when it asks for the picture. */
export class DescribedView extends PictureView {
  constructor(
    camera: CameraSource,
    private describer: FrameDescriber,
  ) {
    super(camera);
  }

  override async describe(question: string): Promise<ToolResult> {
    const description = await this.describer.describe(await this.camera.latest(), question);
    return text(`${DESCRIBED_CAPTION}\n${description}\n\n${PICTURE_HINT}`);
  }
}
