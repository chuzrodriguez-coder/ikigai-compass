import { describe, it, expect } from "vitest";
import { calculateMomentumScore, getWeekStart } from "../lib/momentum";

describe("calculateMomentumScore", () => {
  it("returns 50 as baseline when no data provided", () => {
    expect(calculateMomentumScore({})).toBe(50);
  });

  it("increases score for high energy level", () => {
    const score = calculateMomentumScore({ energyLevel: 5 });
    expect(score).toBeGreaterThan(50);
  });

  it("decreases score for low energy level", () => {
    const score = calculateMomentumScore({ energyLevel: 1 });
    expect(score).toBeLessThan(50);
  });

  it("adds 10 points when both planned and actual actions are present", () => {
    const withActions = calculateMomentumScore({ plannedActions: "Task A", actualActions: "Task A done" });
    const withoutActions = calculateMomentumScore({});
    expect(withActions).toBe(withoutActions + 10);
  });

  it("deducts 5 points for long blockers text", () => {
    const withLongBlockers = calculateMomentumScore({ blockers: "This is a very long blockers description that exceeds 10 characters" });
    const withoutBlockers = calculateMomentumScore({});
    expect(withLongBlockers).toBe(withoutBlockers - 5);
  });

  it("caps score at 100", () => {
    const score = calculateMomentumScore({ energyLevel: 5, satisfactionLevel: 5, plannedActions: "a", actualActions: "b" });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("floors score at 0", () => {
    const score = calculateMomentumScore({ energyLevel: 1, satisfactionLevel: 1, blockers: "This is a very long blocker description" });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("handles missing energyLevel by skipping adjustment", () => {
    const score1 = calculateMomentumScore({});
    const score2 = calculateMomentumScore({ satisfactionLevel: 3 });
    expect(score1).toBe(score2);
  });
});

describe("getWeekStart", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const result = getWeekStart(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a Monday for a given date", () => {
    const wednesday = new Date("2024-01-10"); // a Wednesday
    const weekStart = getWeekStart(wednesday);
    const day = new Date(weekStart).getDay();
    expect(day).toBe(1); // 1 = Monday
  });

  it("returns the same Monday when given a Monday", () => {
    const monday = new Date("2024-01-08"); // a Monday
    const weekStart = getWeekStart(monday);
    expect(weekStart).toBe("2024-01-08");
  });

  it("returns Monday for a Sunday (previous Monday)", () => {
    const sunday = new Date("2024-01-14"); // a Sunday
    const weekStart = getWeekStart(sunday);
    const day = new Date(weekStart).getDay();
    expect(day).toBe(1); // 1 = Monday
  });
});
