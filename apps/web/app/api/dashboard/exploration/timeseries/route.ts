import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type ExplorationTimeseriesGranularity } from "@sac/db";

import { parseExplorationFiltersFromUrl } from "@/lib/server";

export const GET = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();

  const url = new URL(request.url);
  const filters = await parseExplorationFiltersFromUrl(url.searchParams);
  const granularity =
    (url.searchParams.get("granularity") as ExplorationTimeseriesGranularity) ??
    undefined;

  return NextResponse.json({
    data: await repository.getExplorationTimeseries(
      session,
      filters,
      granularity
    )
  });
};
