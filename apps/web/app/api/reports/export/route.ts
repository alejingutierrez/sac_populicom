import { buildMentionReport } from "@sac/service-exports";
import { NextResponse } from "next/server";

import { getDemoSession } from "@sac/auth";
import { getRepository, type MentionFilters } from "@sac/db";

export const POST = async (request: Request) => {
  const payload = (await request.json()) as {
    format: "csv" | "pdf";
    filters?: MentionFilters;
  };
  const session = getDemoSession(request.headers);
  const repository = getRepository();
  await repository.ready();
  const mentions = await repository.listMentions(
    session,
    payload.filters ?? {}
  );
  const artifact = await buildMentionReport(mentions, payload.format);

  return new NextResponse(new Uint8Array(artifact.content), {
    headers: {
      "content-type": artifact.contentType,
      "content-disposition": `attachment; filename="${artifact.fileName}"`
    }
  });
};
