"use server";

import { runManualSync } from "@/lib/sync/run-sync";
import { revalidatePath } from "next/cache";

export async function syncNow() {
  await runManualSync();
  revalidatePath("/dashboard");
}
