import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrustMrrStartup } from "./trustmrr";

describe("fetchTrustMrrStartup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps MRR at zero when only last 30 days revenue is present", async () => {
    vi.stubEnv("TRUSTMRR_API_KEY", "test-key");
    stubTrustMrrFetch({
      detailRevenue: { mrr: 0, last30Days: 123456 },
      listRevenue: { mrr: 999999, last30Days: 123456 },
    });

    const startup = await fetchTrustMrrStartup("acme");

    expect(startup?.mrr).toBe("$0");
    expect(startup?.monthlyMrr).toBe("$0");
    expect(startup?.mrrMinor).toBe(0);
    expect(startup?.last30DaysRevenue).toBe("$123,456");
  });

  it("formats TrustMRR MRR dollars as monthly MRR", async () => {
    vi.stubEnv("TRUSTMRR_API_KEY", "test-key");
    stubTrustMrrFetch({
      detailRevenue: { mrr: 98765, last30Days: 123456 },
      listRevenue: { mrr: 98765, last30Days: 123456 },
    });

    const startup = await fetchTrustMrrStartup("acme");

    expect(startup?.mrr).toBe("$98,765");
    expect(startup?.monthlyMrr).toBe("$98,765");
    expect(startup?.mrrMinor).toBe(9876500);
    expect(startup?.last30DaysRevenue).toBe("$123,456");
  });

  it("uses the live detail endpoint MRR instead of list revenue", async () => {
    vi.stubEnv("TRUSTMRR_API_KEY", "test-key");
    stubTrustMrrFetch({
      detailRevenue: { mrr: 432100, last30Days: 123456 },
      listRevenue: { mrr: 999999, last30Days: 123456 },
    });

    const startup = await fetchTrustMrrStartup("acme");

    expect(startup?.mrr).toBe("$432,100");
    expect(startup?.monthlyMrr).toBe("$432,100");
    expect(startup?.mrrMinor).toBe(43210000);
  });

  it("preserves cents for small live MRR values", async () => {
    vi.stubEnv("TRUSTMRR_API_KEY", "test-key");
    stubTrustMrrFetch({
      detailRevenue: { mrr: 174.09, last30Days: 281.27393199769233 },
      listRevenue: { mrr: 999999, last30Days: 123456 },
    });

    const startup = await fetchTrustMrrStartup("acme");

    expect(startup?.mrr).toBe("$174.09");
    expect(startup?.monthlyMrr).toBe("$174.09");
    expect(startup?.mrrMinor).toBe(17409);
    expect(startup?.last30DaysRevenue).toBe("$281.27");
  });
});

function stubTrustMrrFetch({
  detailRevenue,
  listRevenue,
}: {
  detailRevenue: Record<string, unknown>;
  listRevenue: Record<string, unknown>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const startup = {
        slug: "acme",
        name: "Acme",
        founder: "Ada",
      };

      if (url.pathname.endsWith("/startups/acme")) {
        return jsonResponse({ data: { ...startup, revenue: detailRevenue } });
      }

      return jsonResponse({ data: [{ ...startup, revenue: listRevenue }] });
    }),
  );
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
