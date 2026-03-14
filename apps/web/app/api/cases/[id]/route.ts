import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type UpdateCaseInput } from "@sac/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const PATCH = async (request: Request, context: RouteContext) => {
  const params = await context.params;
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();
  const payload = (await request.json()) as UpdateCaseInput;

  try {
    const record = await repository.updateCase(session, params.id, payload);
    return NextResponse.json({ data: record });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update case"
      },
      { status: 400 }
    );
  }
};
