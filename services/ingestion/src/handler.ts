import { importBrandwatchExportObject, syncBrandwatchWindow } from "./index";

type EventBridgeEvent = {
  agencyId?: string;
  from?: string;
  to?: string;
};

type SqsEvent = {
  Records?: Array<{
    body: string;
  }>;
};

const isSqsEvent = (event: unknown): event is SqsEvent =>
  Boolean(
    event &&
    typeof event === "object" &&
    Array.isArray((event as SqsEvent).Records)
  );

const extractS3Records = (event: SqsEvent) =>
  (event.Records ?? [])
    .flatMap((record) => {
      const parsed = JSON.parse(record.body) as {
        Records?: Array<{
          s3?: {
            bucket?: { name?: string };
            object?: { key?: string };
          };
        }>;
      };

      return (
        parsed.Records?.map((entry) => ({
          bucket: entry.s3?.bucket?.name,
          key: entry.s3?.object?.key
            ? decodeURIComponent(entry.s3.object.key.replaceAll("+", " "))
            : undefined
        })) ?? []
      );
    })
    .filter((entry): entry is { bucket: string; key: string } =>
      Boolean(entry.bucket && entry.key)
    );

export const handler = async (event: EventBridgeEvent | SqsEvent = {}) => {
  if (isSqsEvent(event)) {
    const records = extractS3Records(event);
    const results = [];
    for (const record of records) {
      results.push(
        await importBrandwatchExportObject({
          bucket: record.bucket,
          key: record.key
        })
      );
    }
    return results;
  }

  const current = new Date();
  const to = event.to ?? current.toISOString();
  const from =
    event.from ?? new Date(current.getTime() - 5 * 60 * 1000).toISOString();

  return syncBrandwatchWindow({
    agencyId: event.agencyId ?? "pr-central",
    from,
    to
  });
};
