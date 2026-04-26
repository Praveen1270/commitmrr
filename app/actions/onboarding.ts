"use server";

import { encryptSecret } from "@/lib/security/crypto";
import { fetchDailyCommitCounts, type GitHubRepository } from "@/lib/providers/github";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { importGitHubAccount } from "@/lib/sync/github-import";
import { daysAgo, toDateKey } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const dodoSchema = z.object({
  apiKey: z.string().min(8, "Enter a DodoPayments API key."),
  mode: z.enum(["test", "live"]),
});

const startupSelectionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  founder: z.string().min(1),
  mrr: z.string().min(1),
  mrrMinor: z.coerce.number().int().nonnegative(),
  last30DaysRevenue: z.string().optional(),
  revenueLabel: z.string().optional(),
  growth: z.string().min(1),
  category: z.string().optional(),
  website: z.string().optional(),
});

const repositorySelectionSchema = z.object({
  repositoryId: z.string().uuid(),
  isTracked: z.enum(["true", "false"]),
});

export async function importGitHubRepositories() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!user) redirect("/login");

  const token = sessionData.session?.provider_token || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub token unavailable. Reconnect GitHub or set GITHUB_TOKEN locally.");

  const { repositories } = await importGitHubAccount({
    supabase,
    token,
    userId: user.id,
  });

  await syncCommitMetrics({
    supabase,
    userId: user.id,
    token,
    repositories,
  });

  revalidatePath("/onboarding");
}

export async function selectTrustMrrStartup(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: selectedRepo } = await supabase
    .from("github_repositories")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_tracked", true)
    .limit(1)
    .maybeSingle();

  if (!selectedRepo) redirect("/onboarding?repoRequired=1");

  const selectedStartup = startupSelectionSchema.parse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    founder: formData.get("founder"),
    mrr: formData.get("mrr"),
    mrrMinor: formData.get("mrrMinor"),
    last30DaysRevenue: formData.get("last30DaysRevenue") || "$0",
    revenueLabel: formData.get("revenueLabel") || "Revenue",
    growth: formData.get("growth"),
    category: formData.get("category") || "",
    website: formData.get("website") || "",
  });

  const { data: existingConnection } = await supabase
    .from("provider_connections")
    .select("config, external_account_id")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .maybeSingle();

  const existingConfig = isRecord(existingConnection?.config)
    ? existingConnection.config
    : {};

  const { error } = await supabase.from("provider_connections").upsert(
    {
      user_id: user.id,
      provider: "github",
      mode: "oauth",
      external_account_id: existingConnection?.external_account_id ?? null,
      connected_at: new Date().toISOString(),
      config: {
        ...existingConfig,
        selectedStartup,
        matchedStartup: selectedStartup,
        selectedAt: new Date().toISOString(),
      },
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw error;
  await syncTrustMrrRevenueMetrics({
    supabase,
    userId: user.id,
    selectedStartup,
  });
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect("/onboarding");
}

export async function disableTrustMrrStartup() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existingConnection } = await supabase
    .from("provider_connections")
    .select("config, external_account_id")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .maybeSingle();

  const existingConfig = isRecord(existingConnection?.config)
    ? existingConnection.config
    : {};
  const remainingConfig = { ...existingConfig };
  delete remainingConfig.matchedAt;
  delete remainingConfig.matchedStartup;
  delete remainingConfig.selectedAt;
  delete remainingConfig.selectedStartup;

  const { error } = await supabase.from("provider_connections").upsert(
    {
      user_id: user.id,
      provider: "github",
      mode: "oauth",
      external_account_id: existingConnection?.external_account_id ?? null,
      connected_at: new Date().toISOString(),
      config: {
        ...remainingConfig,
        startupDisabledAt: new Date().toISOString(),
      },
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw error;

  const { error: revenueError } = await supabase
    .from("daily_revenue_metrics")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "dodo");

  if (revenueError) throw revenueError;

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function toggleGitHubRepository(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = repositorySelectionSchema.parse({
    repositoryId: formData.get("repositoryId"),
    isTracked: formData.get("isTracked"),
  });

  const { error } = await supabase
    .from("github_repositories")
    .update({ is_tracked: parsed.isTracked !== "true" })
    .eq("id", parsed.repositoryId)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/onboarding");
}

async function syncCommitMetrics({
  supabase,
  userId,
  token,
  repositories,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  token: string;
  repositories: GitHubRepository[];
}) {
  const from = daysAgo(30);
  const to = new Date();
  const metrics = await fetchDailyCommitCounts({ token, repositories, from, to });
  const repoByFullName = new Map(repositories.map((repo) => [repo.fullName, repo]));

  if (!metrics.length) return;

  const { data: repoRows, error: repoRowsError } = await supabase
    .from("github_repositories")
    .select("id, full_name")
    .eq("user_id", userId);

  if (repoRowsError) throw repoRowsError;

  const repoIdByFullName = new Map(
    ((repoRows ?? []) as { id: string; full_name: string }[]).map((repo) => [
      repo.full_name,
      repo.id,
    ]),
  );

  const upserts = metrics.flatMap((metric) => {
    const importedRepo = repoByFullName.get(metric.repositoryFullName);
    const repositoryId = repoIdByFullName.get(metric.repositoryFullName);
    if (!importedRepo || !repositoryId) return [];

    return {
      user_id: userId,
      repository_id: repositoryId,
      metric_date: metric.date,
      commit_count: metric.commitCount,
      updated_at: new Date().toISOString(),
    };
  });

  if (!upserts.length) return;

  const { error } = await supabase
    .from("daily_commit_metrics")
    .upsert(upserts, { onConflict: "user_id,repository_id,metric_date" });

  if (error) throw error;
}

async function syncTrustMrrRevenueMetrics({
  supabase,
  userId,
  selectedStartup,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  selectedStartup: z.infer<typeof startupSelectionSchema>;
}) {
  const monthlyMrrMinor = selectedStartup.mrrMinor;
  const dailyRevenueMinor = Math.round(monthlyMrrMinor / 30);
  const now = new Date();

  const rows = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (29 - index));

    return {
      user_id: userId,
      provider: "dodo",
      metric_date: toDateKey(date),
      currency: "USD",
      gross_amount_minor: dailyRevenueMinor,
      net_amount_minor: dailyRevenueMinor,
      payment_count: dailyRevenueMinor > 0 ? 1 : 0,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("daily_revenue_metrics")
    .upsert(rows, { onConflict: "user_id,provider,metric_date,currency" });

  if (error) throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function saveDodoConnection(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = dodoSchema.parse({
    apiKey: formData.get("apiKey"),
    mode: formData.get("mode") || "test",
  });

  const { error } = await supabase.from("provider_connections").upsert(
    {
      user_id: user.id,
      provider: "dodo",
      mode: parsed.mode,
      encrypted_secret: encryptSecret(parsed.apiKey),
      connected_at: new Date().toISOString(),
      config: { storedBy: "server-action" },
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw error;
  revalidatePath("/onboarding");
  redirect("/dashboard");
}
