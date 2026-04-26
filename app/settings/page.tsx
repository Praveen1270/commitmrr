import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: connections } = await supabase
    .from("provider_connections")
    .select("provider, mode, connected_at, last_synced_at")
    .eq("user_id", user.id);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-semibold">Settings</h1>
        <div className="mt-6 space-y-3">
          {(connections ?? []).map((connection) => (
            <div key={connection.provider} className="rounded-2xl bg-slate-100 p-4">
              <p className="font-semibold capitalize">{connection.provider}</p>
              <p className="mt-1 text-sm text-slate-600">Mode: {connection.mode}. Last sync: {connection.last_synced_at ?? "never"}.</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
