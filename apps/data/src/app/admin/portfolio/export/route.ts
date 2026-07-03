import { NextRequest, NextResponse } from "next/server";
import { getPortfolioCardRowsCsv, type PortfolioCardSort, type PortfolioGrade } from "@gci/core";

export const dynamic = "force-dynamic";

function isValidSort(v: string | null): v is PortfolioCardSort {
  return v === "registered_desc" || v === "value_desc" || v === "recent_desc";
}

function isValidGrade(v: string | null): v is PortfolioGrade {
  return v === "RAW" || v === "PSA10" || v === "PSA_OTHER" || v === "OTHER_GRADED";
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const game   = params.get("game") || undefined;
  const gradeP = params.get("grade");
  const grade  = isValidGrade(gradeP) ? gradeP : undefined;
  const search = params.get("q") || undefined;
  const sortP  = params.get("sort");
  const sort   = isValidSort(sortP) ? sortP : "registered_desc";

  const csv = await getPortfolioCardRowsCsv({ game, grade, search, sort });

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="portfolio-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
