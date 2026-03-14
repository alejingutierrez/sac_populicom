import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = async (request: Request, context: RouteContext) => {
  const params = await context.params;
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();

  try {
    const alert = await repository.acknowledgeAlert(session, params.id);
    return NextResponse.json({ data: alert });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to acknowledge alert"
      },
      { status: 400 }
    );
  }
};
