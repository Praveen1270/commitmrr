"use server";

import { getDashboardData } from "@/lib/data/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

export async function createShareReport() {
  const supabase = await createSupabaseServerClient();
  const dashboard = await getDashboardData();

  if (!dashboard?.user) redirect("/login");
  if (!dashboard.series.length) redirect("/dashboard");

  const slug = randomUUID().slice(0, 8);
  const title = "My CommitMRR revenue signal";
  const summary = dashboard.latestInsight.summary;

  const { error } = await supabase.from("share_reports").insert({
    user_id: dashboard.user.id,
    slug,
    title,
    summary,
    is_public: true,
    snapshot: {
      totals: dashboard.totals,
      series: dashboard.series,
      insight: dashboard.latestInsight,
      currency: dashboard.currency,
      generatedAt: new Date().toISOString(),
    },
  });

  if (error) throw error;
  redirect(`/r/${slug}`);
}
