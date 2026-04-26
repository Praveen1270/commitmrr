import {
  fetchGitHubRepositories,
  fetchGitHubViewer,
  type GitHubRepository,
} from "@/lib/providers/github";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function importGitHubAccount({
  supabase,
  token,
  userId,
}: {
  supabase: SupabaseServerClient;
  token: string;
  userId: string;
}) {
  const [viewer, repositories] = await Promise.all([
    fetchGitHubViewer(token),
    fetchGitHubRepositories(token),
  ]);

  if (repositories.length) {
    const { data: existingRepos, error: existingReposError } = await supabase
      .from("github_repositories")
      .select("github_id, is_tracked")
      .eq("user_id", userId);

    if (existingReposError) throw existingReposError;

    const trackedByGithubId = new Map(
      ((existingRepos ?? []) as { github_id: number; is_tracked: boolean }[]).map((repo) => [
        repo.github_id,
        repo.is_tracked,
      ]),
    );

    const { error } = await supabase.from("github_repositories").upsert(
      repositories.map((repo) => ({
        user_id: userId,
        github_id: repo.githubId,
        owner: repo.owner,
        name: repo.name,
        full_name: repo.fullName,
        html_url: repo.htmlUrl,
        is_private: repo.private,
        is_tracked: trackedByGithubId.get(repo.githubId) ?? false,
      })),
      { onConflict: "user_id,github_id" },
    );

    if (error) throw error;
  }

  const { data: existingConnection, error: existingConnectionError } = await supabase
    .from("provider_connections")
    .select("config")
    .eq("user_id", userId)
    .eq("provider", "github")
    .maybeSingle();

  if (existingConnectionError) throw existingConnectionError;

  const existingConfig = isRecord(existingConnection?.config)
    ? existingConnection.config
    : {};

  const { error } = await supabase.from("provider_connections").upsert(
    {
      user_id: userId,
      provider: "github",
      mode: "oauth",
      external_account_id: viewer.login,
      connected_at: new Date().toISOString(),
      config: {
        ...existingConfig,
        githubLogin: viewer.login,
      },
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw error;

  return { repositories, viewer };
}

export type ImportedGitHubRepository = GitHubRepository;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
