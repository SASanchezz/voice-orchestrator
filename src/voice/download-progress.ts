const PERCENT = 100;
const PRINT_EVERY_PERCENT = 5;
const BYTES_PER_MB = 1e6;

/** "  45%  210/466 MB" on one terminal line, updated every 5%. */
export class DownloadProgress {
  received = 0;
  private lastPercent = -1;

  constructor(private total: number) {}

  add(bytes: number): void {
    this.received += bytes;
    const percent = this.total ? Math.floor((this.received / this.total) * PERCENT) : -1;
    if (percent === this.lastPercent || percent % PRINT_EVERY_PERCENT !== 0) return;
    process.stdout.write(`\r  ${percent}%  ${megabytes(this.received)}/${megabytes(this.total)} MB`);
    this.lastPercent = percent;
  }
}

function megabytes(bytes: number): string {
  return (bytes / BYTES_PER_MB).toFixed(0);
}
