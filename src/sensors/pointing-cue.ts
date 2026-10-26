/** Added to your words when you pointed while saying them, so the model knows to look at the camera. */
export const POINTING_NOTE = "[gesture] user is pointing";

/** Whether you pointed at something while you talked: already when you started, or at any moment after. */
export class PointingCue {
  private pointing = false;
  private pointedThisTalk = false;

  pointStarted(): void {
    this.pointing = true;
    this.pointedThisTalk = true;
  }

  pointEnded(): void {
    this.pointing = false;
  }

  talkStarted(): void {
    this.pointedThisTalk = this.pointing;
  }

  /** Your words, with the pointing note after them if you pointed while saying them. */
  annotate(text: string): string {
    return this.pointedThisTalk ? `${text}\n${POINTING_NOTE}` : text;
  }
}
