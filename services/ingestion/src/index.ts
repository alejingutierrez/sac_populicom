import { MockBrandwatchClient, normalizeBrandwatchMention, type BrandwatchClient } from "@sac/brandwatch";
import { loadConfig } from "@sac/config";
import { getRepository } from "@sac/db";

export type SyncWindowInput = {
  agencyId: string;
  from: string;
  to: string;
};

export const syncBrandwatchWindow = async (
  input: SyncWindowInput,
  client: BrandwatchClient = new MockBrandwatchClient()
) => {
  const config = loadConfig();
  const repository = getRepository();
  const startedAt = new Date().toISOString();
  const result = await client.fetchMentions({
    agencyId: input.agencyId,
    from: input.from,
    to: input.to,
    sources: ["social", "news", "web"]
  });
  const mentions = result.items.map((item) =>
    normalizeBrandwatchMention(input.agencyId, item, `s3://${config.RAW_BUCKET_NAME}/${input.agencyId}/${item.id}.json`)
  );

  return repository.upsertMentions(mentions, {
    agencyId: input.agencyId,
    fetchedCount: result.items.length,
    sourceWindow: `${input.from}/${input.to}`,
    startedAt,
    finishedAt: new Date().toISOString()
  });
};
