import { runManualSync } from "@/lib/sync/run-sync";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await runManualSync();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 400 },
    );
  }
}
