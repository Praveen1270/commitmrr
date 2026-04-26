import { runManualSync } from "@/lib/sync/run-sync";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await runManualSync();
    revalidatePath("/");
    revalidatePath("/dashboard");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 400 },
    );
  }
}
