import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type MentionFilters } from "@sac/db";

export const GET = (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  const { searchParams } = new URL(request.url);
  const filters: MentionFilters = {
    agencyId: searchParams.get("agencyId") ?? undefined,
    source: (searchParams.get("source") as MentionFilters["source"]) ?? undefined,
    sentiment: (searchParams.get("sentiment") as MentionFilters["sentiment"]) ?? undefined,
    priority: (searchParams.get("priority") as MentionFilters["priority"]) ?? undefined,
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined
  };

  return NextResponse.json({
    data: repository.listMentions(session, filters)
  });
};
