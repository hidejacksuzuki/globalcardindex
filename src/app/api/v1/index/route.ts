import { NextResponse } from "next/server";
import { getLatestIndex } from "@/actions";
import type { ApiResponse, IndexSnapshot } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<
  NextResponse<ApiResponse<IndexSnapshot | null>>
> {
  try {
    const data = await getLatestIndex();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
