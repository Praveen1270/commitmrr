import { getDodoBaseUrl } from "@/lib/env";
import { toDateKey } from "@/lib/utils";

export type DodoMode = "test" | "live";

export type DailyRevenueMetric = {
  date: string;
  currency: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  paymentCount: number;
};

type DodoPayment = {
  created_at: string;
  currency: string;
  payment_id: string;
  refund_status?: "partial" | "full" | null;
  status?: string | null;
  total_amount: number;
};

type DodoPaymentsResponse = {
  items: DodoPayment[];
};

export async function fetchDailyDodoRevenue({
  apiKey,
  from,
  to,
  mode = "test",
}: {
  apiKey: string;
  from: Date;
  to: Date;
  mode?: DodoMode;
}) {
  const baseUrl = getDodoBaseUrl(mode);
  const totals = new Map<string, DailyRevenueMetric>();
  let pageNumber = 0;

  while (pageNumber < 25) {
    const url = new URL("/payments", baseUrl);
    url.searchParams.set("created_at_gte", from.toISOString());
    url.searchParams.set("created_at_lte", to.toISOString());
    url.searchParams.set("status", "succeeded");
    url.searchParams.set("page_size", "100");
    url.searchParams.set("page_number", String(pageNumber));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`DodoPayments request failed with ${response.status}.`);
    }

    const data = (await response.json()) as DodoPaymentsResponse;
    for (const payment of data.items ?? []) {
      if (payment.status && payment.status !== "succeeded") continue;
      if (payment.refund_status === "full") continue;

      const date = toDateKey(payment.created_at);
      const currency = payment.currency || "USD";
      const key = `${date}:${currency}`;
      const existing = totals.get(key) ?? {
        date,
        currency,
        grossAmountMinor: 0,
        netAmountMinor: 0,
        paymentCount: 0,
      };

      existing.grossAmountMinor += payment.total_amount;
      existing.netAmountMinor += payment.total_amount;
      existing.paymentCount += 1;
      totals.set(key, existing);
    }

    if (!data.items || data.items.length < 100) break;
    pageNumber += 1;
  }

  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
}
