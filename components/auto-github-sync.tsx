"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "commitmrr:last-github-sync";

export function AutoGitHubSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const lastSync = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - lastSync < SYNC_INTERVAL_MS) return;

    window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));

    fetch("/api/sync", { method: "POST" })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => {
        window.sessionStorage.removeItem(STORAGE_KEY);
      });
  }, [enabled, router]);

  return null;
}
