import { buildInsightSummary, type DailyJoinedMetric, type InsightSummary } from "@/lib/analytics/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysAgo, toDateKey } from "@/lib/utils";

type CommitRow = { metric_date: string; commit_count: number };
type RevenueRow = { metric_date: string; net_amount_minor: number; currency: string };
type InsightRow = { result: InsightSummary; created_at: string };
type ReportRow = { slug: string; title: string; created_at: string };
type RepoRow = { id: string };

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const from = toDateKey(daysAgo(60));
  const to = toDateKey(new Date());

  const { data: repos } = await supabase
    .from("github_repositories")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_tracked", true);
  const trackedRepoIds = ((repos ?? []) as RepoRow[]).map((repo) => repo.id);

  const commitQuery = supabase
    .from("daily_commit_metrics")
    .select("metric_date, commit_count")
    .eq("user_id", user.id)
    .gte("metric_date", from)
    .lte("metric_date", to);

  const [{ data: commits }, { data: revenue }, { data: insights }, { data: reports }, { data: dodo }, { data: githubConnection }] = await Promise.all([
    trackedRepoIds.length
      ? commitQuery.in("repository_id", trackedRepoIds)
      : Promise.resolve({ data: [] }),
    supabase.from("daily_revenue_metrics").select("metric_date, net_amount_minor, currency").eq("user_id", user.id).gte("metric_date", from).lte("metric_date", to),
    supabase.from("insight_runs").select("result, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("share_reports").select("slug, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("provider_connections").select("last_synced_at, mode").eq("user_id", user.id).eq("provider", "dodo").maybeSingle(),
    supabase.from("provider_connections").select("config").eq("user_id", user.id).eq("provider", "github").maybeSingle(),
  ]);

  const selectedStartup = trackedRepoIds.length
    ? getSelectedStartup(githubConnection?.config)
    : null;
  const revenueRows = selectedStartup ? (revenue ?? []) as RevenueRow[] : [];
  const series = joinMetrics((commits ?? []) as CommitRow[], revenueRows);
  const fallbackInsight = buildInsightSummary(series);
  const latestInsight = ((insights ?? []) as InsightRow[])[0]?.result ?? fallbackInsight;
  const currency = revenueRows[0]?.currency ?? "USD";

  return {
    user,
    series,
    latestInsight,
    reports: (reports ?? []) as ReportRow[],
    selectedStartup,
    trackedRepoCount: trackedRepoIds.length,
    dodoConnection: dodo,
    currency,
    totals: {
      commits: series.reduce((sum, row) => sum + row.commits, 0),
      revenueMinor: series.reduce((sum, row) => sum + row.revenueMinor, 0),
      activeDays: series.filter((row) => row.commits > 0 || row.revenueMinor > 0).length,
    },
  };
}

function getSelectedStartup(config: unknown) {
  if (!isRecord(config)) return null;
  const selected = config.selectedStartup ?? config.matchedStartup;
  return isRecord(selected) ? selected : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function joinMetrics(commits: CommitRow[], revenue: RevenueRow[]): DailyJoinedMetric[] {
  const byDate = new Map<string, DailyJoinedMetric>();

  for (const row of commits) {
    const existing = byDate.get(row.metric_date) ?? { date: row.metric_date, commits: 0, revenueMinor: 0 };
    existing.commits += row.commit_count;
    byDate.set(row.metric_date, existing);
  }

  for (const row of revenue) {
    const existing = byDate.get(row.metric_date) ?? { date: row.metric_date, commits: 0, revenueMinor: 0 };
    existing.revenueMinor += row.net_amount_minor;
    byDate.set(row.metric_date, existing);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
