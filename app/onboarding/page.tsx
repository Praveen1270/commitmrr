import {
  disableTrustMrrStartup,
  importGitHubRepositories,
  selectTrustMrrStartup,
  toggleGitHubRepository,
} from "@/app/actions/onboarding";
import { searchTrustMrrStartup } from "@/lib/providers/trustmrr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GitBranch, Search, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

type RepoRow = { id: string; full_name: string; html_url: string; is_tracked: boolean };
type StartupSelection = {
  name?: string;
  founder?: string;
  mrr?: string;
  mrrMinor?: number;
  last30DaysRevenue?: string;
  revenueLabel?: string;
  growth?: string;
  slug?: string;
  category?: string;
  website?: string;
} | null;
type GithubConnection = {
  external_account_id: string | null;
  config: {
    matchedStartup?: StartupSelection;
    selectedStartup?: StartupSelection;
  } | null;
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    githubImport?: string;
    message?: string;
    repo?: string;
    repoRequired?: string;
    slug?: string;
  }>;
}) {
  const params = await searchParams;
  const repoQuery = params.repo?.trim() ?? "";
  const slugQuery = params.slug?.trim() ?? "";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: repos }, { data: githubConnection }] = await Promise.all([
    supabase.from("github_repositories").select("id, full_name, html_url, is_tracked").eq("user_id", user.id).order("is_tracked", { ascending: false }).order("full_name").limit(100),
    supabase.from("provider_connections").select("external_account_id, config").eq("user_id", user.id).eq("provider", "github").maybeSingle(),
  ]);
  const connection = githubConnection as GithubConnection | null;
  const matchedStartup =
    connection?.config?.selectedStartup ?? connection?.config?.matchedStartup ?? null;
  const hasGithubConnected = Boolean(connection?.external_account_id || repos?.length);
  const selectedRepoCount = ((repos ?? []) as RepoRow[]).filter((repo) => repo.is_tracked).length;
  const hasSelectedRepo = selectedRepoCount > 0;
  const startup = hasSelectedRepo && slugQuery ? await searchTrustMrrStartup(slugQuery) : null;
  const startups = startup ? [startup] : [];
  const repoRows = repoQuery
    ? ((repos ?? []) as RepoRow[]).filter((repo) =>
      repo.full_name.toLowerCase().includes(repoQuery.toLowerCase()),
    )
    : [];

  return (
    <main className="min-h-screen bg-[#f5f5f4] px-6 py-10 text-black" suppressHydrationWarning>
      <div className="mx-auto max-w-4xl" suppressHydrationWarning>
        <p className="font-mono text-sm font-black text-zinc-500">CommitMRR dashboard</p>
        <h1 className="mt-2 max-w-2xl font-mono text-4xl font-black tracking-[-0.055em]">
          Connect GitHub. Add your startup.
        </h1>
        {params.githubImport === "failed" && (
          <p className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-4 font-mono text-sm leading-6 text-red-700">
            GitHub connected, but repository import failed: {params.message ?? "try refreshing repos."}
          </p>
        )}
        <div className="mt-8 grid gap-5 md:grid-cols-[1fr_1.1fr]">
          <section className="rounded-[14px] border border-zinc-200 bg-white p-6 shadow-sm">
            <GitBranch className="text-zinc-900" />
            <h2 className="mt-4 font-mono text-xl font-black">GitHub repositories</h2>
            <p className="mt-2 font-mono text-sm leading-6 text-zinc-500">
              Import your GitHub profile and choose at least one repo before
              adding a TrustMRR startup.
            </p>
            <form action={importGitHubRepositories} className="mt-5">
              <button className="rounded-[10px] bg-black px-5 py-3 font-mono text-sm font-black text-white">
                {repos?.length ? "Refresh GitHub repos" : "Connect GitHub repos"}
              </button>
            </form>
            {!!repos?.length && (
              <form className="mt-5 flex flex-col gap-2 sm:flex-row">
                {slugQuery && <input type="hidden" name="slug" value={slugQuery} />}
                <input
                  name="repo"
                  defaultValue={repoQuery}
                  placeholder="Search repositories"
                  className="min-h-11 flex-1 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 font-mono text-xs outline-none focus:border-black"
                />
                <button className="rounded-[10px] bg-black px-4 py-3 font-mono text-xs font-black text-white">
                  Search
                </button>
                {repoQuery && (
                  <a
                    href={slugQuery ? `/onboarding?slug=${encodeURIComponent(slugQuery)}` : "/onboarding"}
                    className="rounded-[10px] border border-zinc-200 px-4 py-3 text-center font-mono text-xs font-black text-zinc-600"
                  >
                    Clear
                  </a>
                )}
              </form>
            )}
            <div className="mt-5 space-y-2">
              {repoRows.map((repo) => (
                <form
                  key={repo.id}
                  action={toggleGitHubRepository}
                >
                  <input type="hidden" name="repositoryId" value={repo.id} />
                  <input type="hidden" name="isTracked" value={String(repo.is_tracked)} />
                  <button
                    className={`w-full rounded-[10px] px-4 py-3 text-left font-mono text-xs ${
                      repo.is_tracked
                        ? "border border-black bg-zinc-50 text-black"
                        : "border border-zinc-200 bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>
                        <span className="block font-black">{repo.full_name}</span>
                        <span className="mt-1 block text-[10px] text-zinc-500">
                          {repo.is_tracked ? "Selected for CommitMRR" : "Click to select repo"}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black ${
                          repo.is_tracked ? "bg-black text-white" : "bg-white text-zinc-500"
                        }`}
                      >
                        {repo.is_tracked ? "Selected" : "Off"}
                      </span>
                    </span>
                  </button>
                </form>
              ))}
              {!repos?.length && <p className="font-mono text-sm text-zinc-500">No repositories imported yet.</p>}
              {!!repos?.length && !repoQuery && (
                <p className="rounded-[10px] border border-dashed border-zinc-300 p-4 font-mono text-sm leading-6 text-zinc-500">
                  Search repositories to choose which repos count.
                </p>
              )}
              {!!repos?.length && repoQuery && !repoRows.length && (
                <p className="font-mono text-sm text-zinc-500">
                  No repositories match <span className="font-black">{repoQuery}</span>.
                </p>
              )}
              {!!repos?.length && !hasSelectedRepo && (
                <p className="rounded-[10px] border border-dashed border-zinc-300 p-4 font-mono text-sm leading-6 text-zinc-500">
                  Select a repo first. Startup selection unlocks after at least
                  one repo is selected.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[14px] border border-zinc-200 bg-white p-6 shadow-sm">
            {matchedStartup ? (
              <>
                <ShieldCheck className="text-emerald-600" />
                <h2 className="mt-4 font-mono text-xl font-black">Startup linked</h2>
                <div className="mt-5 rounded-[10px] border border-zinc-200 bg-zinc-50 p-5 font-mono">
                  <p className="text-2xl font-black">{matchedStartup.name}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Founder: {matchedStartup.founder ?? connection?.external_account_id}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-[10px] bg-white p-3">
                      <p className="text-zinc-500">{matchedStartup.revenueLabel ?? "Revenue"}</p>
                      <p className="mt-1 font-black">{matchedStartup.mrr}</p>
                    </div>
                    <div className="rounded-[10px] bg-white p-3">
                      <p className="text-zinc-500">Growth</p>
                      <p className="mt-1 font-black">{matchedStartup.growth}</p>
                    </div>
                  </div>
                  {matchedStartup.category && (
                    <p className="mt-4 text-xs text-zinc-500">
                      Category: {matchedStartup.category}
                    </p>
                  )}
                </div>
                <p className="mt-4 font-mono text-sm leading-6 text-zinc-500">
                  Your TrustMRR revenue is linked to the selected GitHub repos.
                  Turn repos off on the left if they should not count.
                </p>
                <form action={disableTrustMrrStartup} className="mt-4">
                  <button className="rounded-[10px] border border-zinc-300 px-4 py-3 font-mono text-xs font-black text-zinc-700 hover:border-black hover:text-black">
                    Disable startup
                  </button>
                </form>
              </>
            ) : (
              <>
                <Search className="text-zinc-900" />
                <h2 className="mt-4 font-mono text-xl font-black">Waiting for startup</h2>
                <p className="mt-2 font-mono text-sm leading-6 text-zinc-500">
                  Connect GitHub, select a repo, then add your TrustMRR startup
                  below.
                </p>
              </>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-[14px] border border-zinc-200 bg-white p-6 shadow-sm" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <div suppressHydrationWarning>
              <h2 className="font-mono text-xl font-black">Add TrustMRR startup</h2>
              <p className="mt-2 font-mono text-sm leading-6 text-zinc-500">
                Search by TrustMRR slug or URL, then link that startup to the
                commits from your selected GitHub repos.
              </p>
              {params.repoRequired && (
                <p className="mt-3 rounded-[10px] border border-dashed border-zinc-300 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-600">
                  Select a GitHub repo before adding a startup.
                </p>
              )}
            </div>
          </div>

          <form className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              name="slug"
              defaultValue={slugQuery}
              disabled={!hasSelectedRepo}
              placeholder="Search TrustMRR startup"
              className="min-h-12 flex-1 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 font-mono text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:text-zinc-400"
            />
            <button
              disabled={!hasSelectedRepo}
              className="rounded-[10px] bg-black px-5 py-3 font-mono text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {hasSelectedRepo ? "Get startup" : "Select repo first"}
            </button>
          </form>

          <div className="mt-5 grid gap-3 md:grid-cols-2" suppressHydrationWarning>
            {startups.map((startup) => {
              const isSelected = matchedStartup?.slug === startup.slug;

              return (
                <form
                  key={startup.slug}
                  action={selectTrustMrrStartup}
                  className={`rounded-[12px] border font-mono ${
                    isSelected ? "border-black bg-zinc-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <input type="hidden" name="slug" value={startup.slug} />
                  <input type="hidden" name="name" value={startup.name} />
                  <input type="hidden" name="founder" value={startup.founder} />
                  <input type="hidden" name="mrr" value={startup.mrr} />
                  <input type="hidden" name="mrrMinor" value={startup.mrrMinor} />
                  <input type="hidden" name="last30DaysRevenue" value={startup.last30DaysRevenue} />
                  <input type="hidden" name="revenueLabel" value={startup.revenueLabel} />
                  <input type="hidden" name="growth" value={startup.growth} />
                  <input type="hidden" name="category" value={startup.category} />
                  <input type="hidden" name="website" value={startup.website} />

                  <button
                    disabled={!hasSelectedRepo || isSelected}
                    className="block w-full p-4 text-left disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black">{startup.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {startup.founder} · {startup.slug}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                          {[startup.category, startup.techStack.slice(0, 3).join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black text-white">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-[10px] bg-zinc-100 p-3">
                        <p className="text-zinc-500">MRR</p>
                        <p className="mt-1 font-black">{startup.mrr}</p>
                      </div>
                      <div className="rounded-[10px] bg-zinc-100 p-3">
                        <p className="text-zinc-500">Last 30 days</p>
                        <p className="mt-1 font-black">{startup.last30DaysRevenue}</p>
                      </div>
                    </div>

                    <span
                      className={`mt-4 block w-full rounded-[10px] px-4 py-3 text-center text-xs font-black ${
                        isSelected
                          ? "bg-black text-white"
                          : hasSelectedRepo
                            ? "bg-black text-white"
                            : "bg-zinc-300 text-zinc-500"
                      }`}
                    >
                      {isSelected
                        ? "Selected"
                        : hasSelectedRepo
                          ? "Select this startup"
                          : hasGithubConnected
                            ? "Select a repo first"
                            : "Connect GitHub first"}
                    </span>
                  </button>
                </form>
              );
            })}

            {!hasSelectedRepo && (
              <div className="rounded-[12px] border border-dashed border-zinc-300 p-6 font-mono text-sm leading-6 text-zinc-500 md:col-span-2" suppressHydrationWarning>
                Select a GitHub repo first. TrustMRR startup search and
                selection are locked until a repo is selected.
              </div>
            )}

            {hasSelectedRepo && slugQuery && !startups.length && (
              <div className="rounded-[12px] border border-dashed border-zinc-300 p-6 font-mono text-sm leading-6 text-zinc-500 md:col-span-2" suppressHydrationWarning>
                No startup found for “{slugQuery}”. Use the slug from a TrustMRR
                URL, for example `shipfast`.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
