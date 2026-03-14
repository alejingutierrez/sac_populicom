import { getDemoSession } from "@sac/auth";
import { getRepository } from "@sac/db";

import { buildMentionReport, type ExportFormat } from "./index";

type ExportEvent = {
  format?: ExportFormat;
};

export const handler = async (event: ExportEvent = {}) => {
  const repository = getRepository();
  const mentions = repository.listMentions(getDemoSession());

  return buildMentionReport(mentions, event.format ?? "csv");
};
