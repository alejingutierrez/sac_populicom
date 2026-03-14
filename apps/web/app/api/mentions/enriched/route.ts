import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type MentionFilters } from "@sac/db";

export const GET = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();

  const { searchParams } = new URL(request.url);
  const filters: MentionFilters = {
    agencyId: searchParams.get("agencyId") ?? undefined,
    source:
      (searchParams.get("source") as MentionFilters["source"]) ?? undefined,
    sentiment:
      (searchParams.get("sentiment") as MentionFilters["sentiment"]) ??
      undefined,
    priority:
      (searchParams.get("priority") as MentionFilters["priority"]) ?? undefined,
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined
  };

  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  return NextResponse.json({
    data: await repository.listMentionsEnriched(session, filters, {
      includeDisabled: searchParams.get("includeDisabled") === "true",
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    })
  });
};
