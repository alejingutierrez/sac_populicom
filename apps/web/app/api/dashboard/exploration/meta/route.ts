import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

import { parseExplorationFiltersFromUrl } from "@/lib/server";

export const GET = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();

  const filters = await parseExplorationFiltersFromUrl(
    new URL(request.url).searchParams
  );

  return NextResponse.json({
    data: await repository.getExplorationMeta(session, {
      agencyId: filters.agencyId ?? session.activeAgencyId
    })
  });
};
