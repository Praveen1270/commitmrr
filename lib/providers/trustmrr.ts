export type TrustMrrStartup = {
  slug: string;
  name: string;
  founder: string;
  xHandle: string;
  xFollowerCount: number | null;
  mrr: string;
  monthlyMrr: string;
  allTimeRevenue: string;
  allTimeRevenueMinor: number;
  monthlyMrrMinor: number;
  mrrMinor: number;
  revenueLabel: string;
  growth: string;
  icon: string;
  description: string;
  website: string;
  category: string;
  techStack: string[];
  rank: number | null;
  raw: Record<string, unknown>;
};

type TrustMrrListResponse = {
  data?: unknown[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
};

type TrustMrrDetailResponse = {
  data?: unknown;
};

export async function fetchTrustMrrStartups({
  limit = 10,
  includeDetails = true,
  query,
  sort = "revenue-desc",
}: {
  limit?: number;
  includeDetails?: boolean;
  query?: string;
  sort?: string;
} = {}) {
  const apiKey = process.env.TRUSTMRR_API_KEY;
  if (!apiKey) return [];

  const url = getTrustMrrUrl("/startups");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", "1");
  url.searchParams.set("sort", sort);
  if (query?.trim()) {
    url.searchParams.set("q", query.trim());
    url.searchParams.set("search", query.trim());
  }

  const response = await trustMrrFetch(url, apiKey, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as TrustMrrListResponse;
  const startups = (payload.data ?? [])
    .filter(isRecord)
    .map(normalizeStartup)
    .filter((startup) => startup.name !== "Unknown startup")
    .filter((startup) => matchesQuery(startup, query));

  if (!includeDetails) return startups;

  // TrustMRR is rate-limited to 20 requests/minute. Fetch details only for the
  // visible list so we stay well under the limit during page renders.
  const detailLimit = Math.min(startups.length, 10);
  const detailedStartups = await Promise.all(
    startups.slice(0, detailLimit).map(async (startup) => {
      return (await fetchTrustMrrStartup(startup.slug)) ?? startup;
    }),
  );

  return [...detailedStartups, ...startups.slice(detailLimit)];
}

export async function fetchTrustMrrStartup(slug: string) {
  const apiKey = process.env.TRUSTMRR_API_KEY;
  if (!apiKey) return null;

  const url = getTrustMrrUrl(`/startups/${slug}`);

  const response = await trustMrrFetch(url, apiKey, {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as TrustMrrDetailResponse;
  return isRecord(payload.data) ? normalizeStartup(payload.data) : null;
}

export async function searchTrustMrrStartup(query: string) {
  const slug = toStartupSlug(query);
  if (!slug) return null;
  return fetchTrustMrrStartup(slug);
}

export function matchStartupToGithub({
  startups,
  githubLogin,
  repositoryFullNames,
}: {
  startups: TrustMrrStartup[];
  githubLogin: string;
  repositoryFullNames: string[];
}) {
  const loginNeedle = githubLogin.toLowerCase();
  const repoNeedles = repositoryFullNames.map((repo) => repo.toLowerCase());

  return startups
    .map((startup) => {
      const haystack = flattenRecordValues(startup.raw).toLowerCase();
      let score = 0;

      if (loginNeedle && haystack.includes(loginNeedle)) score += 5;
      for (const repo of repoNeedles) {
        if (haystack.includes(repo)) score += 10;
        const repoName = repo.split("/").at(-1);
        if (repoName && haystack.includes(repoName)) score += 2;
      }

      return { startup, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.startup ?? null;
}

function normalizeStartup(raw: Record<string, unknown>): TrustMrrStartup {
  const name = readString(raw, ["name", "startup", "companyName", "company"]);
  const founder = readNestedString(raw, [
    "founder",
    "founderName",
    "owner",
    "user.name",
    "maker.name",
    "cofounders.0.xName",
  ]);
  const xHandle = readNestedString(raw, ["xHandle", "cofounders.0.xHandle"]);
  const xFollowerCount = toNullableNumber(readValue(raw, ["xFollowerCount"]));
  const slug = readString(raw, ["slug", "id"]) || slugify(name || founder || "startup");
  const mrrValue =
    readNestedValue(raw, "revenue.mrr") ??
    readValue(raw, ["mrr", "monthlyRevenue", "verifiedMrr"]);
  const last30DaysRevenueValue = readNestedValue(raw, "revenue.last30Days");
  const allTimeRevenueValue =
    readNestedValue(raw, "revenue.allTime") ??
    readNestedValue(raw, "revenue.total") ??
    readNestedValue(raw, "revenue.totalRevenue") ??
    readValue(raw, [
      "allTimeRevenue",
      "totalRevenue",
      "revenueTotal",
      "grossRevenue",
      "verifiedRevenue",
    ]);
  const mrrMinor = toMinorAmount(mrrValue);
  const last30DaysRevenueMinor = toMinorAmount(last30DaysRevenueValue);
  const allTimeRevenueMinor = toMinorAmount(allTimeRevenueValue);
  const displayRevenueMinor = mrrMinor > 0 ? mrrMinor : last30DaysRevenueMinor;
  const growthValue =
    readValue(raw, ["growthMRR30d", "growth30d", "growth", "growthRate", "revenueGrowth"]);
  const techStack = readTechStack(raw);

  return {
    slug,
    name: name || "Unknown startup",
    founder: founder || xHandle || "Verified founder",
    xHandle,
    xFollowerCount,
    mrr: formatMaybeMoney(displayRevenueMinor),
    monthlyMrr: formatMaybeMoney(mrrMinor),
    allTimeRevenue: formatMaybeMoney(allTimeRevenueMinor),
    allTimeRevenueMinor,
    monthlyMrrMinor: mrrMinor,
    mrrMinor: displayRevenueMinor,
    revenueLabel: mrrMinor > 0 ? "MRR" : "Last 30 days",
    growth: formatMaybePercent(growthValue),
    icon: readString(raw, ["icon"]),
    description: readString(raw, ["description"]),
    website: readString(raw, ["website"]),
    category: readString(raw, ["category"]),
    techStack,
    rank: toNullableNumber(readValue(raw, ["rank"])),
    raw,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readValue(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function readString(raw: Record<string, unknown>, keys: string[]) {
  const value = readValue(raw, keys);
  return value === undefined ? "" : String(value);
}

function readNestedValue(raw: Record<string, unknown>, key: string) {
  const parts = key.split(".");
  let cursor: unknown = raw;

  for (const part of parts) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }

  return typeof cursor === "string" || typeof cursor === "number" ? cursor : undefined;
}

function readNestedString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parts = key.split(".");
    let cursor: unknown = raw;

    for (const part of parts) {
      if (Array.isArray(cursor) && /^\d+$/.test(part)) {
        cursor = cursor[Number(part)];
        continue;
      }

      if (!isRecord(cursor)) {
        cursor = undefined;
        break;
      }
      cursor = cursor[part];
    }

    if (typeof cursor === "string" || typeof cursor === "number") {
      return String(cursor);
    }
  }

  return "";
}

function flattenRecordValues(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenRecordValues).join(" ");
  if (isRecord(value)) return Object.values(value).map(flattenRecordValues).join(" ");
  return "";
}

function formatMaybeMoney(value: unknown) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value / 100);
  }

  if (typeof value === "string" && value.trim()) return value;
  return "$0";
}

function toMinorAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") return parseMoneyToMinor(value);
  return 0;
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMaybePercent(value: unknown) {
  if (typeof value === "number") {
    const percent = value > 1 ? value : value * 100;
    return `${Number(percent.toFixed(1))}%`;
  }
  if (typeof value === "string" && value.trim()) return value;
  return "verified";
}

function readTechStack(raw: Record<string, unknown>) {
  const value = raw.techStack;
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => readString(item, ["slug", "name"]))
    .filter(Boolean);
}

function parseMoneyToMinor(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toStartupSlug(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?trustmrr\.com\/startup\//i, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/$/g, "")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "") ?? "";
}

function matchesQuery(startup: TrustMrrStartup, query?: string) {
  if (!query?.trim()) return true;
  const needle = query.toLowerCase().trim();
  const haystack = [
    startup.name,
    startup.slug,
    startup.founder,
    startup.category,
    startup.website,
    ...startup.techStack,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

function trustMrrFetch(url: URL, apiKey: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...init?.headers,
    },
  });
}

function getTrustMrrUrl(path: string) {
  const baseUrl = process.env.TRUSTMRR_API_BASE_URL || "https://trustmrr.com/api/v1";
  return new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
}
