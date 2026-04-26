import { toDateKey } from "@/lib/utils";

export type GitHubRepository = {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
};

export type DailyCommitMetric = {
  repositoryFullName: string;
  date: string;
  commitCount: number;
};

type GitHubUser = { login: string };
type GitHubRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  owner: { login: string };
};
type GitHubCommitResponse = { sha: string; commit: { author?: { date?: string } } };

async function githubFetch<T>(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchGitHubViewer(token: string) {
  return githubFetch<GitHubUser>("/user", token);
}

export async function fetchGitHubRepositories(token: string) {
  const repos = await githubFetch<GitHubRepoResponse[]>(
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
    token,
  );

  return repos.map((repo) => ({
    githubId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    htmlUrl: repo.html_url,
  }));
}

export async function fetchDailyCommitCounts({
  token,
  repositories,
  from,
  to,
}: {
  token: string;
  repositories: Pick<GitHubRepository, "owner" | "name" | "fullName">[];
  from: Date;
  to: Date;
}) {
  const viewer = await fetchGitHubViewer(token);
  const metrics: DailyCommitMetric[] = [];

  for (const repository of repositories) {
    const counts = new Map<string, number>();
    let page = 1;

    while (page < 11) {
      const search = new URLSearchParams({
        since: from.toISOString(),
        until: to.toISOString(),
        author: viewer.login,
        per_page: "100",
        page: String(page),
      });
      const commits = await githubFetch<GitHubCommitResponse[]>(
        `/repos/${repository.owner}/${repository.name}/commits?${search}`,
        token,
      );

      for (const commit of commits) {
        const dateValue = commit.commit.author?.date;
        if (!dateValue) continue;
        const date = toDateKey(dateValue);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }

      if (commits.length < 100) break;
      page += 1;
    }

    for (const [date, commitCount] of counts) {
      metrics.push({ repositoryFullName: repository.fullName, date, commitCount });
    }
  }

  return metrics.sort((a, b) => a.date.localeCompare(b.date));
}
