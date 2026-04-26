"use client";

import { signInWithGithub } from "@/app/actions/auth";
import { GitBranch, Search, X } from "lucide-react";
import { useState } from "react";

export function AddStartupDialog({ isSignedIn }: { isSignedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-[10px] bg-black px-5 py-3 font-mono text-[12px] font-black text-white shadow-sm hover:bg-zinc-800"
      >
        Join the board
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 sm:items-center">
          <div className="w-full max-w-[640px] overflow-hidden rounded-t-[18px] border border-zinc-200 bg-white shadow-2xl sm:rounded-[18px]">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="font-mono text-[22px] font-black tracking-[-0.055em] text-black">
                  Add your startup
                </h2>
                <p className="mt-3 max-w-xl font-mono text-[15px] leading-7 text-zinc-500">
                  Connect GitHub, choose the repos whose commits should count,
                  then select your TrustMRR startup from the result list.
                </p>
              </div>
              <button
                aria-label="Close add startup dialog"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <X size={21} />
              </button>
            </div>

            <div className="space-y-6 px-1 py-6">
              <div className="px-1">
                <div className="rounded-[10px] border border-zinc-200 bg-zinc-50 p-4 font-mono text-[15px] leading-7 text-zinc-500">
                  <p className="font-normal text-black">
                    CommitMRR ranks founders by commit count from selected GitHub repos.
                  </p>
                  <p className="mt-2">
                    TrustMRR adds the verified startup record. You can disable a startup or turn repos off anytime from
                    the dashboard.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 px-1 sm:grid-cols-3">
                {[
                  [GitBranch, "1", "Connect GitHub"],
                  [GitBranch, "2", "Pick repos"],
                  [Search, "3", "Select TrustMRR"],
                ].map(([Icon, step, label]) => (
                  <div
                    key={String(step)}
                    className="rounded-[10px] border border-zinc-200 bg-white p-4 font-mono text-sm"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] font-black text-white">
                      {String(step)}
                    </span>
                    <Icon className="mt-4 text-zinc-700" size={18} />
                    <p className="mt-2 font-black">{String(label)}</p>
                  </div>
                ))}
              </div>

              {isSignedIn ? (
                <a
                  href="/onboarding"
                  className="mx-1 block w-[calc(100%-0.5rem)] rounded-[10px] bg-black px-5 py-4 text-center font-mono text-[13px] font-black text-white hover:bg-zinc-800"
                >
                  Find my startup
                </a>
              ) : (
                <form action={signInWithGithub} className="mx-1">
                  <button className="w-full rounded-[10px] bg-black px-5 py-4 text-center font-mono text-[13px] font-black text-white hover:bg-zinc-800">
                    Connect GitHub first
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
