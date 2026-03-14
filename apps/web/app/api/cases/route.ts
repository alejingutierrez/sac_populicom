import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type CreateCaseInput } from "@sac/db";

export const POST = async (request: Request) => {
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  const payload = (await request.json()) as CreateCaseInput;

  try {
    const record = repository.createCase(session, payload);
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create case" },
      { status: 400 }
    );
  }
};
