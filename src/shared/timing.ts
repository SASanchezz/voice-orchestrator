const SECOND_MS = 1000;

/** Logs how long a step took since `startedAt`, so a slow voice turn shows where its time went. */
export function logTiming(step: string, startedAt: number): void {
  const seconds = ((Date.now() - startedAt) / SECOND_MS).toFixed(1);
  console.log(`[timing] ${step}: ${seconds} s`);
}

/** Runs `work` and logs how long it took, whether it succeeded or failed. */
export async function timed<T>(step: string, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await work();
  } finally {
    logTiming(step, startedAt);
  }
}
