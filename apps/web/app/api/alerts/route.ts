import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

export const GET = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();
  const { searchParams } = new URL(request.url);

  return NextResponse.json({
    data: await repository.listAlerts(
      session,
      searchParams.get("agencyId") ?? undefined
    )
  });
};
