import { describe, expect, it } from "vitest";
import { buildInsightSummary, pearsonCorrelation } from "./metrics";

describe("pearsonCorrelation", () => {
  it("returns a strong positive correlation for aligned values", () => {
    expect(pearsonCorrelation([1, 2, 3], [10, 20, 30])).toBe(1);
  });

  it("returns null when one series has no variance", () => {
    expect(pearsonCorrelation([1, 1, 1], [10, 20, 30])).toBeNull();
  });
});

describe("buildInsightSummary", () => {
  it("detects a delayed revenue relationship", () => {
    const summary = buildInsightSummary([
      { date: "2026-01-01", commits: 10, revenueMinor: 0 },
      { date: "2026-01-02", commits: 0, revenueMinor: 1000 },
      { date: "2026-01-03", commits: 12, revenueMinor: 0 },
      { date: "2026-01-04", commits: 0, revenueMinor: 1200 },
    ], 2);

    expect(summary.bestLagDays).toBe(1);
    expect(summary.bestLagCorrelation).toBeGreaterThan(0.9);
  });
});
