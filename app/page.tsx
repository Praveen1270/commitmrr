import { AddStartupDialog } from "@/components/landing/add-startup-dialog";
import { AutoGitHubSync } from "@/components/auto-github-sync";
import { fetchTrustMrrStartup, type TrustMrrStartup } from "@/lib/providers/trustmrr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

type LeaderboardRow = {
  rank: string;
  founder: string;
  handle: string;
  startup: string;
  startupIcon: string;
  slug: string;
  commits: string;
  mrr: string;
  avatar: string;
};
type ConnectedStartup = {
  row: LeaderboardRow;
};
type CommitRow = { metric_date: string; commit_count: number };
type ProviderConnectionRow = {
  config: unknown;
  user_id: string;
};
type PublicLeaderboardRow = {
  commit_count: number;
  startup_slug: string;
  user_id: string;
};
type RepoRow = {
  id: string;
  user_id: string;
};

const topRankLabels: Record<string, string> = {
  "1": "🥇",
  "2": "🥈",
  "3": "🥉",
};

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const leaderboard = await getLeaderboard(user?.id);

  return (
    <main className="min-h-screen bg-[#f5f5f4] px-4 py-7 text-black">
      <AutoGitHubSync enabled={Boolean(user)} />
      <section className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col">
        <nav className="flex items-center justify-center">
          <Link href="/" className="font-mono text-sm font-black tracking-tight text-zinc-500">
            Commit<span className="text-blue-600">MRR</span>
          </Link>
        </nav>

        <div className="flex flex-1 flex-col items-center pt-5 text-center sm:pt-7">
          <h1 className="max-w-4xl font-mono text-[28px] font-black leading-tight tracking-[-0.055em] sm:text-[34px]">
            Which founder commits the most?
          </h1>
          <div className="mt-6">
            <AddStartupDialog isSignedIn={Boolean(user)} />
          </div>

          <div className="mt-10 w-full overflow-hidden rounded-[12px] border border-zinc-100 bg-white text-left shadow-sm">
            <div className="px-5 py-4">
              <h2 className="font-mono text-[15px] font-normal text-black">Leaderboard</h2>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">
                CommitMRR ranks founders by commits from selected GitHub repos.
              </p>
            </div>
            <div className="space-y-0 border-t border-zinc-100 md:hidden">
              {leaderboard.map((row) => (
                <div key={`${row.rank}-${row.slug}`} className="border-b border-zinc-100 p-4 font-mono">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-6 shrink-0 text-zinc-500">
                        <RankBadge rank={row.rank} />
                      </span>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 bg-cover bg-center text-[10px] font-bold text-white"
                        style={row.avatar.startsWith("http") ? { backgroundImage: `url(${row.avatar})` } : undefined}
                      >
                        {!row.avatar.startsWith("http") && row.avatar}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-normal text-black">{row.founder}</span>
                        <span className="block truncate text-[10px] text-zinc-500">{row.handle}</span>
                      </span>
                    </div>
                    <span className="shrink-0 text-right text-[12px] font-black">{row.commits}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 pl-9">
                    <span className="inline-flex min-w-0 items-center gap-2 text-[12px] font-normal">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 bg-cover bg-center text-[10px] font-bold"
                        style={row.startupIcon ? { backgroundImage: `url(${row.startupIcon})` } : undefined}
                      >
                        {!row.startupIcon && row.startup.slice(0, 1)}
                      </span>
                      <span className="truncate">{row.startup}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-500">{row.mrr}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead className="text-[10px] font-normal text-zinc-500">
                  <tr className="border-t border-zinc-100">
                    <th className="w-14 px-5 py-3 text-left font-normal">#</th>
                    <th className="px-4 py-3 text-left font-normal">Founder</th>
                    <th className="px-4 py-3 text-left font-normal">Startup</th>
                    <th className="px-4 py-3 text-right font-normal">Commits</th>
                    <th className="px-5 py-3 text-right font-normal">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={`${row.rank}-${row.slug}`} className="border-t border-zinc-100">
                      <td className="px-5 py-3 text-zinc-500">
                        <RankBadge rank={row.rank} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 bg-cover bg-center text-[10px] font-bold text-white"
                            style={row.avatar.startsWith("http") ? { backgroundImage: `url(${row.avatar})` } : undefined}
                          >
                            {!row.avatar.startsWith("http") && row.avatar}
                          </span>
                          <span>
                            <span className="block font-normal text-black">{row.founder}</span>
                            <span className="text-[10px] text-zinc-500">{row.handle}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-normal">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 bg-cover bg-center text-[10px] font-bold"
                            style={row.startupIcon ? { backgroundImage: `url(${row.startupIcon})` } : undefined}
                          >
                            {!row.startupIcon && row.startup.slice(0, 1)}
                          </span>
                          <span>{row.startup}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black">{row.commits}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="block text-zinc-500">{row.mrr}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid w-full gap-4 py-8 text-left sm:grid-cols-3" suppressHydrationWarning>
            {[
              ["1", "Connect GitHub", "We count daily commits from the repos you choose."],
              ["2", "Select repos", "Only selected GitHub repos count toward your CommitMRR rank."],
              ["3", "Select TrustMRR", "Choose the matching startup from the TrustMRR result list."],
            ].map(([step, title, copy]) => (
              <div
                key={step}
                className="rounded-[10px] border border-zinc-200 bg-white p-4 shadow-sm"
                suppressHydrationWarning
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black font-mono text-[11px] font-black text-white">
                  {step}
                </span>
                <h3 className="mt-3 font-mono text-sm font-black">{title}</h3>
                <p className="mt-2 font-mono text-[11px] leading-5 text-zinc-500">{copy}</p>
              </div>
            ))}
          </div>
          {!leaderboard.length && (
            <div
              className="mb-8 w-full rounded-[10px] border border-dashed border-zinc-300 bg-white p-5 text-center font-mono text-sm text-zinc-500"
              suppressHydrationWarning
            >
              Connect GitHub, select a repo, then choose your TrustMRR startup from the list to appear here.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function RankBadge({ rank }: { rank: string }) {
  const label = topRankLabels[rank];

  if (!label) {
    return <span className="text-[11px] text-zinc-500">{rank}</span>;
  }

  return <span className="text-base leading-none">{label}</span>;
}

async function getLeaderboard(currentUserId?: string): Promise<LeaderboardRow[]> {
  const publicRows = await getPublicLeaderboardRows();
  if (publicRows.length) {
    return publicRows;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    const connectedStartup = currentUserId ? await getCurrentUserStartup(currentUserId) : null;
    return connectedStartup ? [connectedStartup.row] : [];
  }

  const [{ data: connections }, { data: repos }] = await Promise.all([
    admin
      .from("provider_connections")
      .select("user_id, config")
      .eq("provider", "github"),
    admin
      .from("github_repositories")
      .select("id, user_id")
      .eq("is_tracked", true),
  ]);
  const repoRows = (repos ?? []) as RepoRow[];
  const repoIds = repoRows.map((repo) => repo.id);
  const { data: commits } = repoIds.length
    ? await admin
      .from("daily_commit_metrics")
      .select("repository_id, commit_count")
      .in("repository_id", repoIds)
    : { data: [] };

  const userIdByRepoId = new Map(repoRows.map((repo) => [repo.id, repo.user_id]));
  const commitsByUserId = new Map<string, number>();
  for (const row of (commits ?? []) as { repository_id: string; commit_count: number }[]) {
    const userId = userIdByRepoId.get(row.repository_id);
    if (!userId) continue;
    commitsByUserId.set(userId, (commitsByUserId.get(userId) ?? 0) + row.commit_count);
  }

  const rows = await Promise.all(
    ((connections ?? []) as ProviderConnectionRow[]).map(async (connection) => {
      const selectedStartup = getSelectedStartup(connection.config);
      if (!selectedStartup?.slug) return null;

      const startup = await fetchTrustMrrStartup(selectedStartup.slug);
      if (!startup) return null;

      return startupToLeaderboardRow(
        startup,
        0,
        commitsByUserId.get(connection.user_id) ?? 0,
      );
    }),
  );

  return rows
    .filter((row): row is LeaderboardRow => Boolean(row))
    .sort((a, b) => parseCommitTotal(b.commits) - parseCommitTotal(a.commits))
    .map((row, index) => ({ ...row, rank: String(index + 1) }));
}

async function getPublicLeaderboardRows() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_leaderboard");

  if (error || !data?.length) return [];

  const rows = await Promise.all(
    ((data ?? []) as PublicLeaderboardRow[]).map(async (row) => {
      if (!row.startup_slug) return null;

      const startup = await fetchTrustMrrStartup(row.startup_slug);
      if (!startup) return null;

      return startupToLeaderboardRow(
        startup,
        0,
        Number(row.commit_count) || 0,
      );
    }),
  );

  return rows
    .filter((row): row is LeaderboardRow => Boolean(row))
    .sort((a, b) => parseCommitTotal(b.commits) - parseCommitTotal(a.commits))
    .map((row, index) => ({ ...row, rank: String(index + 1) }));
}

async function getCurrentUserStartup(userId: string): Promise<ConnectedStartup | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: repos }, { data: connection }] = await Promise.all([
    supabase
      .from("github_repositories")
      .select("id")
      .eq("user_id", userId)
      .eq("is_tracked", true),
    supabase
      .from("provider_connections")
      .select("config")
      .eq("user_id", userId)
      .eq("provider", "github")
      .maybeSingle(),
  ]);
  const repoIds = ((repos ?? []) as { id: string }[]).map((repo) => repo.id);
  if (!repoIds.length) return null;

  const selectedStartup = getSelectedStartup(connection?.config);
  if (!selectedStartup?.slug) return null;
  const startup = await fetchTrustMrrStartup(selectedStartup.slug);
  if (!startup) return null;

  const { data: commits } = await supabase
    .from("daily_commit_metrics")
    .select("metric_date, commit_count")
    .eq("user_id", userId)
    .in("repository_id", repoIds);
  const commitRows = (commits ?? []) as CommitRow[];
  const totalCommits = commitRows.reduce((sum, row) => sum + row.commit_count, 0);

  return {
    row: startupToLeaderboardRow(startup, 0, totalCommits),
  };
}

function parseCommitTotal(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function getSelectedStartup(config: unknown) {
  if (!isRecord(config)) return null;
  const startup = config.selectedStartup ?? config.matchedStartup;
  if (!isRecord(startup) || typeof startup.slug !== "string") return null;
  return { slug: startup.slug };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function startupToLeaderboardRow(
  startup: TrustMrrStartup,
  index: number,
  commitTotal: number | null,
): LeaderboardRow {
  return {
    rank: String(index + 1),
    founder: startup.founder,
    handle: founderMeta(startup),
    startup: startup.name,
    startupIcon: startup.icon,
    slug: startup.slug,
    commits: commitTotal === null ? "connect" : commitTotal.toLocaleString(),
    mrr: startup.monthlyMrr,
    avatar: twitterAvatar(startup) || initials(startup.founder || startup.name),
  };
}

function founderMeta(startup: TrustMrrStartup) {
  const handle = startup.xHandle ? `@${startup.xHandle.replace(/^@/, "")}` : startup.category;
  const followers = startup.xFollowerCount
    ? `${Intl.NumberFormat("en", { notation: "compact" }).format(startup.xFollowerCount)} followers`
    : "";
  return [handle, followers].filter(Boolean).join(" · ") || startup.slug;
}

function twitterAvatar(startup: TrustMrrStartup) {
  if (!startup.xHandle) return "";
  return `https://unavatar.io/twitter/${startup.xHandle.replace(/^@/, "")}`;
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "");
}
