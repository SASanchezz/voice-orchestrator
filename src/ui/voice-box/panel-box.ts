import type { VoiceBoxEvent } from "../voice-box-protocol.js";
import type { BoxChooser } from "./box-chooser.js";
import type { BoxRelay } from "./box-relay.js";
import type { PanelVoiceEvents, VoiceBox, VoiceListener } from "./voice-box.js";

type Relay = Pick<BoxRelay, "stopToEdit">;

/** A native pop-up's text field as a voice box, from the moment the pop-up opens until it closes. */
export class PanelBox implements VoiceBox, PanelVoiceEvents {
  private panel?: VoiceListener;
  private isShut = false;

  constructor(
    private chooser: BoxChooser,
    private relay: Relay,
  ) {}

  /** The pop-up opened. */
  attach(panel: VoiceListener): void {
    this.panel = panel;
  }

  isOpen(): boolean {
    return this.panel !== undefined && !this.isShut;
  }

  tell(event: VoiceBoxEvent): void {
    if (this.isOpen()) this.panel?.tell(event);
  }

  cameToFront(): void {
    this.chooser.used(this);
  }

  editing(): void {
    void this.relay.stopToEdit();
  }

  /** The pop-up closed. */
  shut(): void {
    this.isShut = true;
    this.chooser.forget(this);
  }
}

/** Makes the voice box of each pop-up with a text field. */
export class PanelBoxes {
  constructor(
    private chooser: BoxChooser,
    private relay: Relay,
  ) {}

  create(): PanelBox {
    return new PanelBox(this.chooser, this.relay);
  }
}
