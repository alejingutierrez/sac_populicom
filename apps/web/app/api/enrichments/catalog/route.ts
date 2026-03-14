import { NextResponse } from "next/server";

import { getRepository } from "@sac/db";

export const GET = async () => {
  const repository = getRepository();
  await repository.ready();

  return NextResponse.json({
    data: await repository.listEnrichmentDefinitions()
  });
};
