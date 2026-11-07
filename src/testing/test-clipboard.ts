import type { ClipboardSource, CopiedContent } from "../clipboard/clipboard-source.js";

/** A fake clipboard holding whatever the test put in it; empty to start with. */
export class TestClipboard implements ClipboardSource {
  copied: CopiedContent = {};

  async read(): Promise<CopiedContent> {
    return this.copied;
  }
}
