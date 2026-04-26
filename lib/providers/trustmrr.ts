export type TrustMrrStartup = {
  slug: string;
  name: string;
  founder: string;
  xHandle: string;
  xFollowerCount: number | null;
  mrr: string;
  monthlyMrr: string;
  last30DaysRevenue: string;
  allTimeRevenue: string;
  allTimeRevenueMinor: number;
  last30DaysRevenueMinor: number;
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
} = {}): Promise<TrustMrrStartup[]> {
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
  const detailedStartups: TrustMrrStartup[] = await Promise.all(
    startups.slice(0, detailLimit).map(async (startup) => {
      return (await fetchTrustMrrStartup(startup.slug)) ?? startup;
    }),
  );

  return [...detailedStartups, ...startups.slice(detailLimit)];
}

export async function fetchTrustMrrStartup(slug: string): Promise<TrustMrrStartup | null> {
  const apiKey = process.env.TRUSTMRR_API_KEY;
  if (!apiKey) return null;

  const url = getTrustMrrUrl(`/startups/${slug}`);

  const response = await trustMrrFetch(url, apiKey, {
    cache: "no-store",
  });

  if (!response.ok) return fetchTrustMrrStartupFromList(slug);

  const payload = (await response.json()) as TrustMrrDetailResponse | Record<string, unknown>;
  const startupPayload = isRecord(payload.data) ? payload.data : payload;
  const detailedStartup = isRecord(startupPayload) ? normalizeStartup(startupPayload) : null;
  const listStartup = await fetchTrustMrrStartupFromList(slug);

  if (detailedStartup && listStartup) return mergeStartupRevenue(detailedStartup, listStartup);
  return detailedStartup ?? listStartup;
}

export async function searchTrustMrrStartup(query: string) {
  const slug = toStartupSlug(query);
  if (!slug) return null;
  return fetchTrustMrrStartup(slug);
}

async function fetchTrustMrrStartupFromList(slug: string): Promise<TrustMrrStartup | null> {
  const startups: TrustMrrStartup[] = await fetchTrustMrrStartups({
    includeDetails: false,
    limit: 20,
    query: slug,
  });

  return startups.find((startup: TrustMrrStartup) => startup.slug === slug) ?? startups[0] ?? null;
}

function mergeStartupRevenue(
  detailedStartup: TrustMrrStartup,
  listStartup: TrustMrrStartup,
): TrustMrrStartup {
  return {
    ...detailedStartup,
    mrr: detailedStartup.mrr,
    monthlyMrr: detailedStartup.monthlyMrr,
    last30DaysRevenue: firstNonZeroMoney(
      detailedStartup.last30DaysRevenue,
      listStartup.last30DaysRevenue,
    ),
    allTimeRevenue: firstNonZeroMoney(detailedStartup.allTimeRevenue, listStartup.allTimeRevenue),
    allTimeRevenueMinor: Math.max(
      detailedStartup.allTimeRevenueMinor,
      listStartup.allTimeRevenueMinor,
    ),
    last30DaysRevenueMinor: Math.max(
      detailedStartup.last30DaysRevenueMinor,
      listStartup.last30DaysRevenueMinor,
    ),
    monthlyMrrMinor: detailedStartup.monthlyMrrMinor,
    mrrMinor: detailedStartup.mrrMinor,
    revenueLabel: detailedStartup.revenueLabel,
    raw: {
      detail: detailedStartup.raw,
      list: listStartup.raw,
    },
  };
}

function firstNonZeroMoney(...values: string[]) {
  return values.find((value) => value.trim() && value.trim() !== "$0") ?? "$0";
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
  const trustMrrRevenue = readTrustMrrRevenue(raw);
  const mrrValue =
    trustMrrRevenue.mrr ??
    readMoneyPath(raw, "revenue.mrr") ??
    readValue(raw, ["mrr", "monthlyRevenue", "verifiedMrr"]);
  const last30DaysRevenueValue = trustMrrRevenue.last30Days ?? readFirstMoneyValue(raw, [
    "revenue.last30Days",
    "revenue.last_30_days",
    "revenue.last30DaysRevenue",
    "revenue.last_30_days_revenue",
    "revenue.last30DaysRevenueMinor",
    "revenue.last_30_days_revenue_minor",
    "revenue.last30DaysRevenueCents",
    "revenue.last_30_days_revenue_cents",
    "metrics.last30Days",
    "metrics.last_30_days",
    "metrics.last30DaysRevenue",
    "metrics.last_30_days_revenue",
    "metrics.last30DaysRevenueMinor",
    "metrics.last_30_days_revenue_minor",
    "metrics.last30DaysRevenueCents",
    "metrics.last_30_days_revenue_cents",
  ], [
    "last30DaysRevenue",
    "last_30_days_revenue",
    "last30DaysRevenueMinor",
    "last_30_days_revenue_minor",
    "last30DaysRevenueCents",
    "last_30_days_revenue_cents",
    "last30Days",
    "last_30_days",
  ]);
  const allTimeRevenueValue = trustMrrRevenue.allTime ?? readFirstMoneyValue(raw, [
    "revenue.allTime",
    "revenue.all_time",
    "revenue.total",
    "revenue.totalRevenue",
    "revenue.total_revenue",
    "revenue.totalRevenueMinor",
    "revenue.total_revenue_minor",
    "revenue.totalRevenueCents",
    "revenue.total_revenue_cents",
    "revenue.allTimeRevenue",
    "revenue.all_time_revenue",
    "revenue.allTimeRevenueMinor",
    "revenue.all_time_revenue_minor",
    "revenue.allTimeRevenueCents",
    "revenue.all_time_revenue_cents",
    "metrics.allTimeRevenue",
    "metrics.all_time_revenue",
    "metrics.allTimeRevenueMinor",
    "metrics.all_time_revenue_minor",
    "metrics.allTimeRevenueCents",
    "metrics.all_time_revenue_cents",
    "metrics.totalRevenue",
    "metrics.total_revenue",
    "metrics.totalRevenueMinor",
    "metrics.total_revenue_minor",
    "metrics.totalRevenueCents",
    "metrics.total_revenue_cents",
  ], [
      "allTimeRevenue",
      "all_time_revenue",
      "all_time_revenue_usd",
      "allTimeRevenueUsd",
      "allTimeRevenueMinor",
      "all_time_revenue_minor",
      "allTimeRevenueCents",
      "all_time_revenue_cents",
      "totalRevenue",
      "total_revenue",
      "total_revenue_usd",
      "totalRevenueUsd",
      "totalRevenueMinor",
      "total_revenue_minor",
      "totalRevenueCents",
      "total_revenue_cents",
      "revenueTotal",
      "revenue_total",
      "grossRevenue",
      "gross_revenue",
      "verifiedRevenue",
      "verified_revenue",
    ]) ?? findRevenueLikeValue(raw);
  const mrrMinor = toMinorAmount(mrrValue);
  const last30DaysRevenueMinor = toMinorAmount(last30DaysRevenueValue);
  const allTimeRevenueMinor = toMinorAmount(allTimeRevenueValue);
  const growthValue =
    readValue(raw, ["growthMRR30d", "growth30d", "growth", "growthRate", "revenueGrowth"]);
  const techStack = readTechStack(raw);

  return {
    slug,
    name: name || "Unknown startup",
    founder: founder || xHandle || "Verified founder",
    xHandle,
    xFollowerCount,
    mrr: formatMaybeMoney(mrrMinor),
    monthlyMrr: formatMaybeMoney(mrrMinor),
    last30DaysRevenue: formatMaybeMoney(last30DaysRevenueMinor),
    allTimeRevenue: formatMaybeMoney(allTimeRevenueMinor),
    allTimeRevenueMinor,
    last30DaysRevenueMinor,
    monthlyMrrMinor: mrrMinor,
    mrrMinor,
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

function readTrustMrrRevenue(raw: Record<string, unknown>) {
  const revenue = raw.revenue;
  if (!isRecord(revenue)) {
    return {};
  }

  return {
    mrr: readTrustMrrDollarValue(revenue.mrr),
    last30Days: readTrustMrrDollarValue(revenue.last30Days ?? revenue.last_30_days),
    allTime: readTrustMrrDollarValue(
      revenue.allTime ??
      revenue.all_time ??
      revenue.total ??
      revenue.totalRevenue ??
      revenue.total_revenue,
    ),
  };
}

function readTrustMrrDollarValue(value: unknown): string | number | undefined {
  if (typeof value === "number") return dollarsToMinor(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // TrustMRR revenue fields are dollar amounts. Convert plain numeric values
    // into minor units so the rest of the app has one money representation.
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const amount = Number(trimmed);
      return Number.isFinite(amount) ? dollarsToMinor(amount) : undefined;
    }

    return trimmed;
  }

  if (!isRecord(value)) return undefined;

  for (const key of [
    "amountMinor",
    "amount_minor",
    "amountCents",
    "amount_cents",
    "minor",
    "cents",
    "valueMinor",
    "value_minor",
    "valueCents",
    "value_cents",
    "amount",
    "value",
  ]) {
    const nested = value[key];
    const parsed = isMinorAmountKey(key)
      ? readMinorAmountValue(nested)
      : readTrustMrrDollarValue(nested);
    if (parsed !== undefined) return parsed;
  }

  return readMoneyValue(value);
}

function readMinorAmountValue(value: unknown): string | number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const amount = Number(trimmed);
    return Number.isFinite(amount) ? amount : trimmed;
  }
  return undefined;
}

function isMinorAmountKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("minor") || normalized.includes("cent");
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

function readFirstMoneyValue(
  raw: Record<string, unknown>,
  nestedKeys: string[],
  topLevelKeys: string[],
) {
  for (const key of nestedKeys) {
    const value = readMoneyPath(raw, key);
    if (value !== undefined) return value;
  }

  for (const key of topLevelKeys) {
    const value = readMoneyValue(raw[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function readMoneyPath(raw: Record<string, unknown>, key: string) {
  const parts = key.split(".");
  let cursor: unknown = raw;

  for (const part of parts) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }

  return readMoneyValue(cursor);
}

function readMoneyValue(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  if (!isRecord(value)) return undefined;

  for (const key of [
    "formatted",
    "display",
    "label",
    "amountMinor",
    "amount_minor",
    "amountCents",
    "amount_cents",
    "minor",
    "cents",
    "valueMinor",
    "value_minor",
    "valueCents",
    "value_cents",
    "amount",
    "value",
    "usd",
  ]) {
    const nested = value[key];
    if (typeof nested === "string" || typeof nested === "number") return nested;
  }

  return undefined;
}

function findRevenueLikeValue(value: unknown): string | number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRevenueLikeValue(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!isRecord(value)) return undefined;

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const looksLikeRevenue =
      normalizedKey.includes("revenue") &&
      !normalizedKey.includes("growth") &&
      !normalizedKey.includes("mrr") &&
      !normalizedKey.includes("monthly") &&
      !normalizedKey.includes("last30");

    if (looksLikeRevenue) {
      const money = readMoneyValue(nested);
      if (money !== undefined) return money;
    }

    const found = findRevenueLikeValue(nested);
    if (found !== undefined) return found;
  }

  return undefined;
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
    const hasCents = Math.abs(value % 100) > Number.EPSILON;

    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(value / 100);
  }

  if (typeof value === "string" && value.trim()) return value;
  return "$0";
}

function dollarsToMinor(value: number) {
  return Math.round(value * 100);
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
