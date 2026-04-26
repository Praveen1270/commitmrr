import { buildInsightSummary, type DailyJoinedMetric } from "@/lib/analytics/metrics";
import { decryptSecret } from "@/lib/security/crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysAgo, toDateKey } from "@/lib/utils";
import { fetchDailyDodoRevenue } from "@/lib/providers/dodo";
import { fetchDailyCommitCounts } from "@/lib/providers/github";

type RepoRow = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
};

type RevenueRow = {
  metric_date: string;
  net_amount_minor: number;
};

type CommitRow = {
  metric_date: string;
  commit_count: number;
};

export async function runManualSync() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!user) {
    throw new Error("You must be signed in to sync metrics.");
  }

  const githubToken = sessionData.session?.provider_token || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GitHub provider token is unavailable. Reconnect GitHub or set GITHUB_TOKEN locally.");
  }

  const { data: repos, error: reposError } = await supabase
    .from("github_repositories")
    .select("id, owner, name, full_name")
    .eq("user_id", user.id)
    .eq("is_tracked", true);

  if (reposError) throw reposError;
  if (!repos?.length) throw new Error("Choose at least one repository before syncing.");

  const { data: dodoConnection, error: dodoError } = await supabase
    .from("provider_connections")
    .select("id, encrypted_secret, mode")
    .eq("user_id", user.id)
    .eq("provider", "dodo")
    .single();

  if (dodoError) throw dodoError;
  if (!dodoConnection.encrypted_secret) {
    throw new Error("Add a DodoPayments API key before syncing revenue.");
  }

  const from = daysAgo(60);
  const to = new Date();
  const repoRows = repos as RepoRow[];

  const [commitMetrics, revenueMetrics] = await Promise.all([
    fetchDailyCommitCounts({
      token: githubToken,
      repositories: repoRows.map((repo) => ({
        owner: repo.owner,
        name: repo.name,
        fullName: repo.full_name,
      })),
      from,
      to,
    }),
    fetchDailyDodoRevenue({
      apiKey: decryptSecret(dodoConnection.encrypted_secret),
      from,
      to,
      mode: dodoConnection.mode === "live" ? "live" : "test",
    }),
  ]);

  const repoByFullName = new Map(repoRows.map((repo) => [repo.full_name, repo]));
  const commitUpserts = commitMetrics.flatMap((metric) => {
    const repo = repoByFullName.get(metric.repositoryFullName);
    if (!repo) return [];
    return [{
      user_id: user.id,
      repository_id: repo.id,
      metric_date: metric.date,
      commit_count: metric.commitCount,
      updated_at: new Date().toISOString(),
    }];
  });

  if (commitUpserts.length) {
    const { error } = await supabase
      .from("daily_commit_metrics")
      .upsert(commitUpserts, { onConflict: "user_id,repository_id,metric_date" });
    if (error) throw error;
  }

  if (revenueMetrics.length) {
    const { error } = await supabase.from("daily_revenue_metrics").upsert(
      revenueMetrics.map((metric) => ({
        user_id: user.id,
        provider: "dodo",
        metric_date: metric.date,
        currency: metric.currency,
        gross_amount_minor: metric.grossAmountMinor,
        net_amount_minor: metric.netAmountMinor,
        payment_count: metric.paymentCount,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,provider,metric_date,currency" },
    );
    if (error) throw error;
  }

  const joinedMetrics = await loadJoinedMetrics(user.id, toDateKey(from), toDateKey(to));
  const insight = buildInsightSummary(joinedMetrics);

  await supabase.from("insight_runs").insert({
    user_id: user.id,
    date_range_start: toDateKey(from),
    date_range_end: toDateKey(to),
    result: insight,
  });

  await supabase
    .from("provider_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", dodoConnection.id);

  return {
    commitDays: commitMetrics.length,
    revenueDays: revenueMetrics.length,
    insight,
  };
}

async function loadJoinedMetrics(userId: string, from: string, to: string): Promise<DailyJoinedMetric[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: commits }, { data: revenue }] = await Promise.all([
    supabase
      .from("daily_commit_metrics")
      .select("metric_date, commit_count")
      .eq("user_id", userId)
      .gte("metric_date", from)
      .lte("metric_date", to),
    supabase
      .from("daily_revenue_metrics")
      .select("metric_date, net_amount_minor")
      .eq("user_id", userId)
      .gte("metric_date", from)
      .lte("metric_date", to),
  ]);

  const byDate = new Map<string, DailyJoinedMetric>();
  for (const row of (commits ?? []) as CommitRow[]) {
    const existing = byDate.get(row.metric_date) ?? { date: row.metric_date, commits: 0, revenueMinor: 0 };
    existing.commits += row.commit_count;
    byDate.set(row.metric_date, existing);
  }
  for (const row of (revenue ?? []) as RevenueRow[]) {
    const existing = byDate.get(row.metric_date) ?? { date: row.metric_date, commits: 0, revenueMinor: 0 };
    existing.revenueMinor += row.net_amount_minor;
    byDate.set(row.metric_date, existing);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
