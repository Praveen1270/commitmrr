export type DailyJoinedMetric = {
  date: string;
  commits: number;
  revenueMinor: number;
};

export type InsightSummary = {
  sameDayCorrelation: number | null;
  bestLagDays: number;
  bestLagCorrelation: number | null;
  highCommitRevenueLiftPercent: number | null;
  revenueWithoutCommitDays: number;
  summary: string;
};

export function pearsonCorrelation(xValues: number[], yValues: number[]) {
  if (xValues.length !== yValues.length || xValues.length < 2) return null;

  const xMean = average(xValues);
  const yMean = average(yValues);
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  xValues.forEach((x, index) => {
    const xDelta = x - xMean;
    const yDelta = yValues[index] - yMean;
    numerator += xDelta * yDelta;
    xDenominator += xDelta ** 2;
    yDenominator += yDelta ** 2;
  });

  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (denominator === 0) return null;
  return Number((numerator / denominator).toFixed(3));
}

export function buildInsightSummary(metrics: DailyJoinedMetric[], maxLagDays = 14): InsightSummary {
  const ordered = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const sameDayCorrelation = pearsonCorrelation(
    ordered.map((metric) => metric.commits),
    ordered.map((metric) => metric.revenueMinor),
  );

  let bestLagDays = 0;
  let bestLagCorrelation = sameDayCorrelation;

  for (let lag = 1; lag <= maxLagDays; lag += 1) {
    const commits = ordered.slice(0, -lag).map((metric) => metric.commits);
    const revenue = ordered.slice(lag).map((metric) => metric.revenueMinor);
    const correlation = pearsonCorrelation(commits, revenue);
    if (correlation !== null && (bestLagCorrelation === null || correlation > bestLagCorrelation)) {
      bestLagDays = lag;
      bestLagCorrelation = correlation;
    }
  }

  const commitCounts = ordered.map((metric) => metric.commits);
  const commitAverage = average(commitCounts);
  const highCommitDays = ordered.filter((metric) => metric.commits > commitAverage);
  const otherDays = ordered.filter((metric) => metric.commits <= commitAverage);
  const highCommitRevenue = average(highCommitDays.map((metric) => metric.revenueMinor));
  const otherRevenue = average(otherDays.map((metric) => metric.revenueMinor));
  const highCommitRevenueLiftPercent = otherRevenue > 0
    ? Number((((highCommitRevenue - otherRevenue) / otherRevenue) * 100).toFixed(1))
    : null;

  const revenueWithoutCommitDays = ordered.filter(
    (metric) => metric.commits === 0 && metric.revenueMinor > 0,
  ).length;

  return {
    sameDayCorrelation,
    bestLagDays,
    bestLagCorrelation,
    highCommitRevenueLiftPercent,
    revenueWithoutCommitDays,
    summary: summarize({ sameDayCorrelation, bestLagDays, bestLagCorrelation, revenueWithoutCommitDays }),
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize({
  sameDayCorrelation,
  bestLagDays,
  bestLagCorrelation,
  revenueWithoutCommitDays,
}: Pick<InsightSummary, "sameDayCorrelation" | "bestLagDays" | "bestLagCorrelation" | "revenueWithoutCommitDays">) {
  if (bestLagCorrelation !== null && bestLagCorrelation > 0.45 && bestLagDays > 0) {
    return `Revenue appears to follow coding activity most strongly after ${bestLagDays} day${bestLagDays === 1 ? "" : "s"}.`;
  }

  if (sameDayCorrelation !== null && sameDayCorrelation > 0.45) {
    return "Higher commit days are moving with revenue on the same day.";
  }

  if (revenueWithoutCommitDays > 3) {
    return "A meaningful share of revenue is arriving on days without commits, suggesting marketing, sales, or compounding product effects.";
  }

  return "CommitMRR needs more synced history before it can call out a strong revenue pattern.";
}
