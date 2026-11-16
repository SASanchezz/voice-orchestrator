import { PlanUsageReader } from "../limits/plan-usage-reader.js";
import { RecentPlanUsage } from "../limits/recent-plan-usage.js";
import type { WakeTrainingControl } from "../wake/wake-training.js";
import { AskedReads } from "../ui/server/asked-reads.js";
import { MessengerStatusRoute } from "../ui/server/messenger-status-route.js";
import { PlanUsageRoute } from "../ui/server/plan-usage-route.js";
import type { UiAccess } from "../ui/server/ui-access.js";
import { WakeRecordingRoutes } from "../ui/server/wake-recording-routes.js";
import { buildMessengerStatus } from "./build-messages.js";
import type { Core } from "./core.js";

/** Plan usage for the top bar, which messengers are connected for ⚙ › Messengers, and your wake word recordings. */
export function askedReads(core: Core, access: UiAccess, wakeTraining: WakeTrainingControl): AskedReads {
  const usage = new PlanUsageRoute(access, new RecentPlanUsage(new PlanUsageReader(core.cfg)));
  const messengers = new MessengerStatusRoute(access, buildMessengerStatus(core.cfg, core.messengers));
  return new AskedReads(usage, messengers, new WakeRecordingRoutes(access, wakeTraining));
}
