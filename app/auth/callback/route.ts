import { getAppUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { importGitHubAccount } from "@/lib/sync/github-import";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin || getAppUrl();
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") || "/onboarding";

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorCode) loginUrl.searchParams.set("error_code", errorCode);
    if (errorDescription) loginUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "exchange_failed");
      loginUrl.searchParams.set("error_description", exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    const token = exchangeData.session?.provider_token;
    const userId = exchangeData.user?.id;

    if (token && userId) {
      try {
        await importGitHubAccount({ supabase, token, userId });
      } catch (importError) {
        const onboardingUrl = new URL("/onboarding", origin);
        onboardingUrl.searchParams.set("githubImport", "failed");
        onboardingUrl.searchParams.set(
          "message",
          importError instanceof Error ? importError.message : "GitHub repository import failed.",
        );
        return NextResponse.redirect(onboardingUrl);
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
