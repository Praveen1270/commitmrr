import { signInWithGithub } from "@/app/actions/auth";
import { GitBranch } from "lucide-react";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl">
        <Link href="/" className="text-sm text-slate-300">CommitMRR</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Sign in with GitHub</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          CommitMRR uses GitHub OAuth to read repository activity and align it with your payment data.
        </p>
        {params.error_description && (
          <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            <p className="font-semibold">GitHub sign-in failed</p>
            <p className="mt-1">{params.error_description}</p>
            {params.error_code && <p className="mt-1 text-red-200/70">Code: {params.error_code}</p>}
          </div>
        )}
        <form action={signInWithGithub} className="mt-8">
          <button className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-3 font-semibold text-slate-950">
            <GitBranch size={18} /> Continue with GitHub
          </button>
        </form>
      </div>
    </main>
  );
}
