import { createShareReport } from "@/app/actions/reports";
import { signOut } from "@/app/actions/auth";
import { AutoGitHubSync } from "@/components/auto-github-sync";
import { CommitRevenueChart } from "@/components/charts/commit-revenue-chart";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatMoneyFromMinor } from "@/lib/utils";
import { BarChart3, GitBranch, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  if (!dashboard) redirect("/login");

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
      <AutoGitHubSync enabled={Boolean(dashboard.user)} />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">CommitMRR dashboard</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight">Does building move revenue?</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Setup</Link>
            <form action={signOut}>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Sign out</button>
            </form>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Revenue" value={formatMoneyFromMinor(dashboard.totals.revenueMinor, dashboard.currency)} icon={<BarChart3 size={20} />} />
          <MetricCard label="Commits" value={dashboard.totals.commits.toLocaleString()} icon={<GitBranch size={20} />} />
          <MetricCard label="Active days" value={dashboard.totals.activeDays.toLocaleString()} icon={<Sparkles size={20} />} />
          <MetricCard label="Tracked repos" value={dashboard.trackedRepoCount.toLocaleString()} icon={<GitBranch size={20} />} />
        </section>

        <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Latest insight</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {selectedStartupName(dashboard.selectedStartup)
                  ? `${selectedStartupName(dashboard.selectedStartup)}: commits vs ${selectedStartupRevenueLabel(dashboard.selectedStartup)}`
                  : dashboard.latestInsight.summary}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-900/80">
                Showing selected GitHub repo commits against verified TrustMRR revenue.
                Same-day correlation: {formatCorrelation(dashboard.latestInsight.sameDayCorrelation)}. Best lag: {dashboard.latestInsight.bestLagDays} day(s) with {formatCorrelation(dashboard.latestInsight.bestLagCorrelation)} correlation.
              </p>
            </div>
            <form action={createShareReport}>
              <button className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950"><Share2 size={16} /> Create report</button>
            </form>
          </div>
        </section>

        <section className="mt-6">
          <CommitRevenueChart data={dashboard.series} currency={dashboard.currency} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Recent metrics</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="p-3">Date</th><th className="p-3">Commits</th><th className="p-3">Revenue</th></tr>
                </thead>
                <tbody>
                  {dashboard.series.slice(-10).reverse().map((row) => (
                    <tr key={row.date} className="border-t border-slate-100">
                      <td className="p-3">{row.date}</td>
                      <td className="p-3">{row.commits}</td>
                      <td className="p-3">{formatMoneyFromMinor(row.revenueMinor, dashboard.currency)}</td>
                    </tr>
                  ))}
                  {!dashboard.series.length && <tr><td colSpan={3} className="p-6 text-center text-slate-500">No synced metrics yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Share reports</h2>
            <div className="mt-4 space-y-3">
              {dashboard.reports.map((report) => (
                <Link key={report.slug} href={`/r/${report.slug}`} className="block rounded-2xl bg-slate-100 p-4 text-sm font-medium text-slate-700">
                  {report.title}
                  <span className="mt-1 block text-xs text-slate-500">/{report.slug}</span>
                </Link>
              ))}
              {!dashboard.reports.length && <p className="text-sm leading-6 text-slate-500">Create a report after your first sync to get a public link.</p>}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between text-slate-500"><span className="text-sm font-medium">{label}</span>{icon}</div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function formatCorrelation(value: number | null) {
  return value === null ? "not enough data" : value.toFixed(2);
}

function selectedStartupName(startup: Record<string, unknown> | null) {
  return typeof startup?.name === "string" ? startup.name : "";
}

function selectedStartupRevenueLabel(startup: Record<string, unknown> | null) {
  return typeof startup?.revenueLabel === "string" ? startup.revenueLabel : "revenue";
}
