export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDodoBaseUrl(mode?: string | null) {
  const environment = mode || process.env.DODO_PAYMENTS_ENVIRONMENT || "test";
  return environment === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}
