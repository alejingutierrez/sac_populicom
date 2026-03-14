import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = async (request: Request, context: RouteContext) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();
  const { searchParams } = new URL(request.url);
  const params = await context.params;

  return NextResponse.json({
    data: await repository.getMentionEnrichments(session, params.id, {
      includeDisabled: searchParams.get("includeDisabled") === "true"
    })
  });
};
