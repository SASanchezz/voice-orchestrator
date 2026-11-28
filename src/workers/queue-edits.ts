import type { QueueItem } from "./queued-task.js";

// A queue after one change; the others keep their places. A task that is gone leaves the queue as it was.

export function withoutTask(queued: QueueItem[], taskId: string): QueueItem[] {
  return queued.filter((item) => item.id !== taskId);
}

export function withInstruction(queued: QueueItem[], taskId: string, instruction: string): QueueItem[] {
  return queued.map((item) => (item.id === taskId ? { ...item, instruction } : item));
}

export function withTaskFirst(queued: QueueItem[], taskId: string): QueueItem[] {
  const moved = queued.filter((item) => item.id === taskId);
  return [...moved, ...withoutTask(queued, taskId)];
}
