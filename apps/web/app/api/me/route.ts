import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

export const GET = (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();

  return NextResponse.json({
    session,
    agencies: repository.listAgencies(session)
  });
};
