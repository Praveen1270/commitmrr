import { CommitRevenueChart } from "@/components/charts/commit-revenue-chart";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoneyFromMinor } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

type ReportSnapshot = {
  totals: { commits: number; revenueMinor: number; activeDays: number };
  series: { date: string; commits: number; revenueMinor: number }[];
  insight: { summary: string; bestLagDays: number; revenueWithoutCommitDays: number };
  currency: string;
  generatedAt: string;
};

export default async function ShareReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from("share_reports")
    .select("title, summary, snapshot, created_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!report) notFound();

  const snapshot = report.snapshot as ReportSnapshot;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="font-semibold">CommitMRR</Link>
          <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Create yours</Link>
        </nav>
        <section className="py-14">
          <p className="text-sm font-semibold text-emerald-300">Public revenue signal</p>
          <h1 className="mt-3 max-w-4xl text-5xl font-semibold tracking-tight">{report.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{report.summary}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ReportCard label="Revenue" value={formatMoneyFromMinor(snapshot.totals.revenueMinor, snapshot.currency)} />
            <ReportCard label="Commits" value={snapshot.totals.commits.toLocaleString()} />
            <ReportCard label="Active days" value={snapshot.totals.activeDays.toLocaleString()} />
          </div>
        </section>
        <div className="rounded-[2rem] bg-slate-100 p-4 text-slate-950">
          <CommitRevenueChart data={snapshot.series} currency={snapshot.currency} />
        </div>
        <p className="mt-6 text-sm text-slate-400">Generated {new Date(snapshot.generatedAt).toLocaleDateString()} with CommitMRR.</p>
      </div>
    </main>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}
