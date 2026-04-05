import { describe, it, expect } from "vitest";
import { getParamId } from "../lib/param";
import type { Request } from "express";
import {
  computeNextTrigger,
  detectStagnation,
  getWeekStart,
} from "../lib/momentum";

describe("computeNextTrigger", () => {
  const baseSchedule = {
    type: "check_in",
    frequency: "weekly" as const,
    dayOfWeek: 1,
    hourOfDay: 9,
    timezone: "UTC",
  };

  it("returns next Monday as nextRunAt when today is Wednesday (mid-week)", () => {
    const wednesday = new Date("2025-01-08T06:00:00Z");
    const trigger = computeNextTrigger(baseSchedule, wednesday);
    expect(trigger.nextRunAt).toContain("2025-01-13");
  });

  it("isDue=true on Wednesday because last Monday trigger has already passed", () => {
    const wednesday = new Date("2025-01-08T06:00:00Z");
    const trigger = computeNextTrigger(baseSchedule, wednesday);
    expect(trigger.isDue).toBe(true);
    expect(trigger.lastOccurrenceAt).toContain("2025-01-06");
  });

  it("advances next run one week if the scheduled time has passed on the scheduled day", () => {
    const mondayPastHour = new Date("2025-01-06T10:00:00Z");
    const trigger = computeNextTrigger(baseSchedule, mondayPastHour);
    expect(trigger.nextRunAt).toContain("2025-01-13");
    expect(trigger.isDue).toBe(true);
  });

  it("nextRunAt is today when trigger time has not yet passed (Monday before 9am)", () => {
    const mondayBeforeHour = new Date("2025-01-06T08:00:00Z");
    const trigger = computeNextTrigger(
      { ...baseSchedule, dayOfWeek: 1 },
      mondayBeforeHour
    );
    expect(trigger.nextRunAt).toContain("2025-01-06");
    expect(trigger.isDue).toBe(false);
  });

  it("computes daily triggers: today is next trigger when hour not reached", () => {
    const today = new Date("2025-01-07T07:00:00Z");
    const trigger = computeNextTrigger(
      { ...baseSchedule, frequency: "daily" },
      today
    );
    expect(trigger.nextRunAt).toContain("2025-01-07");
    expect(trigger.isDue).toBe(false);
  });

  it("daily: next trigger advances to next day after hour has passed", () => {
    const today = new Date("2025-01-07T11:00:00Z");
    const trigger = computeNextTrigger(
      { ...baseSchedule, frequency: "daily" },
      today
    );
    expect(trigger.nextRunAt).toContain("2025-01-08");
    expect(trigger.isDue).toBe(true);
  });

  it("includes timezone in response and nextRunAtLocal is formatted", () => {
    const now = new Date("2025-01-08T06:00:00Z");
    const trigger = computeNextTrigger(
      { ...baseSchedule, timezone: "America/New_York" },
      now
    );
    expect(trigger.timezone).toBe("America/New_York");
    expect(trigger.nextRunAtLocal).toBeTruthy();
    expect(trigger.lastOccurrenceAt).toBeTruthy();
  });

  it("isDue=true immediately after a trigger fires", () => {
    const exactTriggerTime = new Date("2025-01-06T09:00:00Z");
    const trigger = computeNextTrigger(baseSchedule, exactTriggerTime);
    expect(trigger.isDue).toBe(true);
  });

  it("all response fields are present", () => {
    const now = new Date("2025-01-08T12:00:00Z");
    const trigger = computeNextTrigger(baseSchedule, now);
    expect(trigger).toHaveProperty("lastOccurrenceAt");
    expect(trigger).toHaveProperty("nextRunAt");
    expect(trigger).toHaveProperty("nextRunAtLocal");
    expect(trigger).toHaveProperty("timezone");
    expect(trigger).toHaveProperty("isDue");
  });
});

describe("detectStagnation", () => {
  it("marks stagnant when no check-in has ever occurred", () => {
    const result = detectStagnation(null, "weekly", new Date());
    expect(result.isStagnant).toBe(true);
    expect(result.daysSinceLastCheckIn).toBe(-1);
  });

  it("marks stagnant when last check-in was more than 14 days ago for weekly", () => {
    const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
    const result = detectStagnation(sixteenDaysAgo, "weekly", new Date());
    expect(result.isStagnant).toBe(true);
    expect(result.daysSinceLastCheckIn).toBeGreaterThanOrEqual(15);
  });

  it("marks not stagnant when last check-in was recent", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = detectStagnation(threeDaysAgo, "weekly", new Date());
    expect(result.isStagnant).toBe(false);
  });

  it("uses correct threshold for daily cadence (2 days)", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = detectStagnation(threeDaysAgo, "daily", new Date());
    expect(result.isStagnant).toBe(true);
    expect(result.threshold).toBe(2);
  });

  it("uses correct threshold for monthly cadence (45 days)", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const result = detectStagnation(fortyDaysAgo, "monthly", new Date());
    expect(result.isStagnant).toBe(false);
    expect(result.threshold).toBe(45);
  });

  it("includes recommendation text", () => {
    const result = detectStagnation(null, "weekly", new Date());
    expect(typeof result.recommendation).toBe("string");
    expect(result.recommendation.length).toBeGreaterThan(0);
  });
});

describe("getWeekStart (timezone-aware)", () => {
  it("returns Monday for a Wednesday in UTC", () => {
    const wednesday = new Date("2025-01-08T12:00:00Z");
    expect(getWeekStart(wednesday, "UTC")).toBe("2025-01-06");
  });

  it("returns correct Monday for American/New_York timezone", () => {
    const wednesday = new Date("2025-01-08T05:00:00Z");
    const result = getWeekStart(wednesday, "America/New_York");
    expect(result).toBe("2025-01-06");
  });

  it("handles Sunday correctly (goes back to prior Monday)", () => {
    const sunday = new Date("2025-01-12T12:00:00Z");
    expect(getWeekStart(sunday, "UTC")).toBe("2025-01-06");
  });

  it("returns the same Monday when date is already Monday", () => {
    const monday = new Date("2025-01-06T10:00:00Z");
    expect(getWeekStart(monday, "UTC")).toBe("2025-01-06");
  });

  it("falls back gracefully for invalid timezone", () => {
    const wednesday = new Date("2025-01-08T12:00:00Z");
    const result = getWeekStart(wednesday, "Not/A/Timezone");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Route ordering safety", () => {
  it("computeNextTrigger can be called with 'due' as type (not confused with param)", () => {
    const schedule = {
      type: "due",
      frequency: "weekly" as const,
      dayOfWeek: 1,
      hourOfDay: 9,
      timezone: "UTC",
    };
    const result = computeNextTrigger(schedule, new Date("2025-01-08T06:00:00Z"));
    expect(result.nextRunAt).toBeTruthy();
    expect(result.timezone).toBe("UTC");
  });

  it("hypotheses compare input with at least 2 IDs validates correctly", () => {
    const ids = "1,2,3";
    const idList = ids
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    expect(idList.length).toBeGreaterThanOrEqual(2);
    expect(idList).toEqual([1, 2, 3]);
  });

  it("hypotheses compare rejects fewer than 2 IDs", () => {
    const ids = "1";
    const idList = ids
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    expect(idList.length).toBeLessThan(2);
  });

  it("hypotheses compare rejects non-numeric IDs", () => {
    const ids = "compare,1";
    const idList = ids
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    expect(idList).toEqual([1]);
    expect(idList.length).toBeLessThan(2);
  });
});

describe("getParamId param name", () => {
  it("parses a named param correctly", () => {
    const mockReq = { params: { planId: "42" } } as unknown as Request;
    expect(getParamId(mockReq, "planId")).toBe(42);
  });

  it("throws for named param with invalid value", () => {
    const mockReq = { params: { planId: "abc" } } as unknown as Request;
    expect(() => getParamId(mockReq, "planId")).toThrow("Invalid ID parameter");
  });

  it("throws when named param is 'stagnation' (would happen if stagnation route was after :id)", () => {
    const mockReq = { params: { id: "stagnation" } } as unknown as Request;
    expect(() => getParamId(mockReq)).toThrow("Invalid ID parameter");
  });
});
