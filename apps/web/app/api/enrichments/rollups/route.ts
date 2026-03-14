import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import type { EnrichmentGroupBy, EnrichmentWindow } from "@sac/db";
import { getRepository } from "@sac/db";

const allowedGroupBy = new Set<EnrichmentGroupBy>([
  "platform_family",
  "source_class",
  "sentiment",
  "language",
  "country",
  "import_batch_id",
  "source_query_id"
]);

const allowedWindows = new Set<EnrichmentWindow>(["24h", "7d", "batch"]);

export const GET = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();

  const { searchParams } = new URL(request.url);
  const window = (searchParams.get("window") ?? "24h") as EnrichmentWindow;
  const groupBy = (searchParams.get("groupBy") ??
    "platform_family") as EnrichmentGroupBy;

  if (!allowedWindows.has(window)) {
    return NextResponse.json(
      { error: `Unsupported window ${window}` },
      { status: 400 }
    );
  }

  if (!allowedGroupBy.has(groupBy)) {
    return NextResponse.json(
      { error: `Unsupported groupBy ${groupBy}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: await repository.listEnrichmentRollups(session, {
      window,
      groupBy,
      agencyId: searchParams.get("agencyId") ?? undefined,
      batchId: searchParams.get("batchId") ?? undefined,
      includeDisabled: searchParams.get("includeDisabled") === "true"
    })
  });
};
