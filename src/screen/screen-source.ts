export interface Screenshot {
  data: string; // base64
  mimeType: "image/jpeg";
}

/** Snaps the screen when you start talking, and hands that snapshot over when the model asks for it. */
export interface ScreenSource {
  capture(): void;
  latest(): Promise<Screenshot>;
}
