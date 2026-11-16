import type { SamplesEvent, TrainedEvent, TriedEvent } from "./training-event.js";
import type { WakeWordState } from "./wake-switch.js";

const WAKE_PHRASE = "Hey Oracle";
const MIN_WAKE_RECORDINGS = 5;
const GOOD_WAKE_RECORDINGS = 20;
const PERCENT = 100;

/** How many recordings there are, and whether a model is trained yet. */
export function samplesReply({ wake, other, trained }: SamplesEvent): string {
  const recorded = `"${WAKE_PHRASE}" recorded ${times(wake)}, other talk ${times(other)}.`;
  if (trained) return `${recorded} A trained model is saved.`;
  const tooFew = `Record "${WAKE_PHRASE}" at least ${MIN_WAKE_RECORDINGS} times to train.`;
  if (wake < MIN_WAKE_RECORDINGS) return `${recorded} ${tooFew}`;
  return `${recorded} Ready to train (${GOOD_WAKE_RECORDINGS} or more "${WAKE_PHRASE}" recordings work better).`;
}

/** How the new model did on your recordings it wasn't trained on. */
export function trainedReply(trained: TrainedEvent, wakeWord: WakeWordState): string {
  const use = wakeWord === "on" ? "The wake word now listens with it." : "Switch the wake word on to use it.";
  return `${checkedReport(trained)} ${use}`;
}

function checkedReport(trained: TrainedEvent): string {
  const { caught, checked_wake, false_wakes, checked_other, quiet_false_wakes, checked_quiet } = trained;
  if (checked_wake === 0) return "Trained on all your recordings (record 4 or more to also see how well it hears you).";
  const woke = `it woke on ${caught} of ${checked_wake} "${WAKE_PHRASE}"`;
  const other = checked_other === 0 ? "" : `, on ${false_wakes} of ${checked_other} other talk`;
  const quiet = ` and on ${quiet_false_wakes} of ${checked_quiet} stretches of your quiet room`;
  return `Trained. On recordings it didn't learn from, ${woke}${other}${quiet}.`;
}

/** What was deleted, before the recordings left are counted. */
export function deletedReply(count: number): string {
  return count === 1 ? "Deleted 1 recording." : `Deleted ${count} recordings.`;
}

/** Whether a few seconds from the mic would have woken it. */
export function triedReply({ score, threshold }: TriedEvent): string {
  const sure = `${percent(score)}% sure; it wakes at ${percent(threshold)}%`;
  if (score >= threshold) return `It would wake (${sure}).`;
  return `It wouldn't wake (${sure}). If you said "${WAKE_PHRASE}", record a few more and train again.`;
}

function times(count: number): string {
  return count === 1 ? "once" : `${count} times`;
}

function percent(share: number): number {
  return Math.round(share * PERCENT);
}
