export function calculateMomentumScore(data: {
  plannedActions?: string;
  actualActions?: string;
  energyLevel?: number;
  satisfactionLevel?: number;
  blockers?: string;
}): number {
  let score = 50;
  if (data.energyLevel) score += (data.energyLevel - 3) * 8;
  if (data.satisfactionLevel) score += (data.satisfactionLevel - 3) * 8;
  if (data.actualActions && data.plannedActions) {
    score += 10;
  }
  if (data.blockers && data.blockers.length > 10) score -= 5;
  return Math.min(100, Math.max(0, score));
}

function getLocalDateParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")!.value);
    const month = Number(parts.find((p) => p.type === "month")!.value) - 1;
    const day = Number(parts.find((p) => p.type === "day")!.value);
    const rawHour = parts.find((p) => p.type === "hour")!.value;
    const hour = rawHour === "24" ? 0 : Number(rawHour);
    const minute = Number(parts.find((p) => p.type === "minute")!.value);
    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayStr] ?? new Date(year, month, day).getDay();
    return { year, month, day, hour, minute, dayOfWeek };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      dayOfWeek: date.getDay(),
    };
  }
}

function zonedToUtcMs(year: number, month: number, day: number, hour: number, minute: number, timezone: string): number {
  try {
    const localIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const probeUtc = new Date(`${localIso}Z`);
    const fmtParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(probeUtc);
    const fYear = Number(fmtParts.find((p) => p.type === "year")!.value);
    const fMonth = Number(fmtParts.find((p) => p.type === "month")!.value) - 1;
    const fDay = Number(fmtParts.find((p) => p.type === "day")!.value);
    const rawH = fmtParts.find((p) => p.type === "hour")!.value;
    const fHour = rawH === "24" ? 0 : Number(rawH);
    const fMinute = Number(fmtParts.find((p) => p.type === "minute")!.value);
    const displayedUtcMs = Date.UTC(fYear, fMonth, fDay, fHour, fMinute);
    const targetUtcMs = Date.UTC(year, month, day, hour, minute);
    const offsetMs = displayedUtcMs - Date.UTC(probeUtc.getUTCFullYear(), probeUtc.getUTCMonth(), probeUtc.getUTCDate(), probeUtc.getUTCHours(), probeUtc.getUTCMinutes());
    return targetUtcMs - offsetMs;
  } catch {
    return new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`).getTime();
  }
}

export function getWeekStart(date: Date, timezone = "UTC"): string {
  try {
    const { year, month, day, dayOfWeek } = getLocalDateParts(date, timezone);
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const localMonday = new Date(year, month, day + mondayOffset);
    const y = localMonday.getFullYear();
    const m = String(localMonday.getMonth() + 1).padStart(2, "0");
    const d = String(localMonday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0]!;
  }
}

export type ReminderScheduleInput = {
  type: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek: number;
  hourOfDay: number;
  timezone: string;
};

export type TriggerResult = {
  lastOccurrenceAt: string;
  nextRunAt: string;
  nextRunAtLocal: string;
  timezone: string;
  isDue: boolean;
};

function dateToLocalMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

export function computeNextTrigger(
  schedule: ReminderScheduleInput,
  now: Date = new Date()
): TriggerResult {
  const tz = schedule.timezone || "UTC";
  const local = getLocalDateParts(now, tz);
  const nowMs = now.getTime();

  let currentWindowUtcMs: number;
  let nextWindowUtcMs: number;
  let prevWindowUtcMs: number;

  if (schedule.frequency === "daily") {
    const curr = dateToLocalMidnight(local.year, local.month, local.day);
    currentWindowUtcMs = zonedToUtcMs(curr.getFullYear(), curr.getMonth(), curr.getDate(), schedule.hourOfDay, 0, tz);
    const next = dateToLocalMidnight(local.year, local.month, local.day + 1);
    nextWindowUtcMs = zonedToUtcMs(next.getFullYear(), next.getMonth(), next.getDate(), schedule.hourOfDay, 0, tz);
    const prev = dateToLocalMidnight(local.year, local.month, local.day - 1);
    prevWindowUtcMs = zonedToUtcMs(prev.getFullYear(), prev.getMonth(), prev.getDate(), schedule.hourOfDay, 0, tz);
  } else if (schedule.frequency === "weekly") {
    const targetDow = schedule.dayOfWeek;
    const daysSinceLast = (local.dayOfWeek - targetDow + 7) % 7;
    const curr = dateToLocalMidnight(local.year, local.month, local.day - daysSinceLast);
    currentWindowUtcMs = zonedToUtcMs(curr.getFullYear(), curr.getMonth(), curr.getDate(), schedule.hourOfDay, 0, tz);
    const next = dateToLocalMidnight(curr.getFullYear(), curr.getMonth(), curr.getDate() + 7);
    nextWindowUtcMs = zonedToUtcMs(next.getFullYear(), next.getMonth(), next.getDate(), schedule.hourOfDay, 0, tz);
    const prev = dateToLocalMidnight(curr.getFullYear(), curr.getMonth(), curr.getDate() - 7);
    prevWindowUtcMs = zonedToUtcMs(prev.getFullYear(), prev.getMonth(), prev.getDate(), schedule.hourOfDay, 0, tz);
  } else {
    const curr = dateToLocalMidnight(local.year, local.month, 1);
    currentWindowUtcMs = zonedToUtcMs(curr.getFullYear(), curr.getMonth(), 1, schedule.hourOfDay, 0, tz);
    const nextMonth = new Date(local.year, local.month + 1, 1);
    nextWindowUtcMs = zonedToUtcMs(nextMonth.getFullYear(), nextMonth.getMonth(), 1, schedule.hourOfDay, 0, tz);
    const prevMonth = new Date(local.year, local.month - 1, 1);
    prevWindowUtcMs = zonedToUtcMs(prevMonth.getFullYear(), prevMonth.getMonth(), 1, schedule.hourOfDay, 0, tz);
  }

  const isDue = nowMs >= currentWindowUtcMs;
  const lastOccurrenceMs = isDue ? currentWindowUtcMs : prevWindowUtcMs;
  const nextRunMs = isDue ? nextWindowUtcMs : currentWindowUtcMs;

  const nextRunDate = new Date(nextRunMs);
  const nextLocal = getLocalDateParts(nextRunDate, tz);
  const nextLocalStr = `${nextLocal.year}-${String(nextLocal.month + 1).padStart(2, "0")}-${String(nextLocal.day).padStart(2, "0")}T${String(schedule.hourOfDay).padStart(2, "0")}:00:00`;

  return {
    lastOccurrenceAt: new Date(lastOccurrenceMs).toISOString(),
    nextRunAt: nextRunDate.toISOString(),
    nextRunAtLocal: nextLocalStr,
    timezone: tz,
    isDue,
  };
}

export type StagnationResult = {
  isStagnant: boolean;
  daysSinceLastCheckIn: number;
  threshold: number;
  recommendation: string;
};

export function detectStagnation(
  lastCheckInAt: Date | null,
  frequency: "daily" | "weekly" | "monthly",
  now: Date = new Date()
): StagnationResult {
  const thresholdDays =
    frequency === "daily" ? 2 : frequency === "weekly" ? 14 : 45;

  if (!lastCheckInAt) {
    return {
      isStagnant: true,
      daysSinceLastCheckIn: -1,
      threshold: thresholdDays,
      recommendation: "No check-in recorded yet. Start with your first weekly reflection.",
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((now.getTime() - lastCheckInAt.getTime()) / msPerDay);
  const isStagnant = daysSince > thresholdDays;

  return {
    isStagnant,
    daysSinceLastCheckIn: daysSince,
    threshold: thresholdDays,
    recommendation: isStagnant
      ? `It has been ${daysSince} days since your last check-in. A quick reflection now will help you regain momentum.`
      : `You are on track — last check-in was ${daysSince} day${daysSince !== 1 ? "s" : ""} ago.`,
  };
}
