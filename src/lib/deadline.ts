/**
 * deadline.ts — Single source of truth for the effective prediction deadline.
 *
 * Reads from the AppSetting DB table (key = "predictionDeadline").
 * Falls back to PREDICTION_DEADLINE constant if no DB setting is found.
 * Always returns a Date in UTC.
 */

import { prisma } from "@/lib/prisma";
import { PREDICTION_DEADLINE } from "@/lib/constants";

export async function getEffectiveDeadline(): Promise<Date> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "predictionDeadline" },
    });
    if (setting?.value) {
      const d = new Date(setting.value);
      if (!isNaN(d.getTime())) return d;
    }
  } catch {
    // DB might not have AppSetting table yet (migration pending) — use constant.
  }
  return PREDICTION_DEADLINE;
}
