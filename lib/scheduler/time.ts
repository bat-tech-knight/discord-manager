import parser from "cron-parser";

/**
 * Computes the next run time for a scheduled message
 * @param sendAt - One-time send time (UTC)
 * @param recurrenceCron - Cron expression for recurring schedules
 * @param timezone - Timezone string (e.g., 'America/New_York', 'UTC')
 * @param lastRunAt - Last run time for recurring schedules (optional)
 * @returns Next run time in UTC, or null if invalid
 */
export function computeNextRunAt(
  sendAt: Date | string | null,
  recurrenceCron: string | null,
  timezone: string = "UTC",
  lastRunAt?: Date | string | null
): Date | null {
  try {
    // One-time schedule
    if (sendAt && !recurrenceCron) {
      const sendDate = typeof sendAt === "string" ? new Date(sendAt) : sendAt;
      if (isNaN(sendDate.getTime())) {
        return null;
      }
      return sendDate;
    }

    // Recurring schedule
    if (recurrenceCron && !sendAt) {
      // Use last run time if provided, otherwise use now
      const baseDate = lastRunAt
        ? typeof lastRunAt === "string"
          ? new Date(lastRunAt)
          : lastRunAt
        : new Date();

      // Parse cron expression
      const interval = parser.parseExpression(recurrenceCron, {
        tz: timezone,
        currentDate: baseDate,
      });

      const nextDate = interval.next().toDate();
      return nextDate;
    }

    return null;
  } catch (error) {
    console.error("Error computing next run time:", error);
    return null;
  }
}

/**
 * Validates a cron expression
 */
export function validateCronExpression(cron: string): boolean {
  try {
    parser.parseExpression(cron);
    return true;
  } catch {
    return false;
  }
}

/**
 * Common cron presets
 */
export const cronPresets = {
  hourly: "0 * * * *", // Every hour at minute 0
  daily: "0 0 * * *", // Every day at midnight
  weekly: "0 0 * * 0", // Every Sunday at midnight
  monthly: "0 0 1 * *", // First day of every month at midnight
};

/**
 * Gets a human-readable description of a cron expression
 */
export function getCronDescription(cron: string): string {
  try {
    const interval = parser.parseExpression(cron, {
      currentDate: new Date(),
    });
    const next = interval.next().toDate();
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `Runs in ${days} day${days !== 1 ? "s" : ""}`;
    } else if (hours > 0) {
      return `Runs in ${hours} hour${hours !== 1 ? "s" : ""}`;
    } else if (minutes > 0) {
      return `Runs in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else {
      return "Runs soon";
    }
  } catch {
    return "Invalid cron expression";
  }
}

