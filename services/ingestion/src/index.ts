import path from "node:path";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  MockBrandwatchClient,
  loadBrandwatchExportWorkbookFromBuffer,
  normalizeBrandwatchExportWorkbook,
  normalizeBrandwatchMention,
  type BrandwatchClient
} from "@sac/brandwatch";
import { loadConfig } from "@sac/config";
import { getRepository, type Alert } from "@sac/db";

export type SyncWindowInput = {
  agencyId: string;
  from: string;
  to: string;
};

export type ImportObjectInput = {
  agencyId?: string;
  bucket: string;
  key: string;
};

const chunk = <T>(items: T[], size: number) => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

const enqueueAlerts = async (
  alerts: Alert[],
  queueClient = new SQSClient({}),
  queueUrl = process.env.ALERTS_QUEUE_URL
) => {
  if (!queueUrl || alerts.length === 0) {
    return;
  }

  for (const batch of chunk(alerts, 10)) {
    await queueClient.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch.map((alert) => ({
          Id: alert.id,
          MessageBody: JSON.stringify(alert)
        }))
      })
    );
  }
};

const resolveAgencyIdFromImportKey = (key: string) => {
  const segments = key.split("/");
  const agencyIndex = segments.findIndex((segment) => segment === "brandwatch");
  if (agencyIndex >= 0 && segments[agencyIndex + 1]) {
    return segments[agencyIndex + 1];
  }
  return undefined;
};

const readObjectBody = async (
  client: S3Client,
  bucket: string,
  key: string
) => {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`Empty S3 object body for s3://${bucket}/${key}`);
  }

  return Buffer.from(bytes);
};

export const syncBrandwatchWindow = async (
  input: SyncWindowInput,
  client: BrandwatchClient = new MockBrandwatchClient(),
  queueClient = new SQSClient({})
) => {
  const config = loadConfig();
  const repository = getRepository();
  await repository.ready();
  const startedAt = new Date().toISOString();
  const result = await client.fetchMentions({
    agencyId: input.agencyId,
    from: input.from,
    to: input.to,
    sources: ["social", "news", "web"]
  });
  const mentions = result.items.map((item) =>
    normalizeBrandwatchMention(
      input.agencyId,
      item,
      `s3://${config.RAW_BUCKET_NAME}/${input.agencyId}/${item.id}.json`
    )
  );

  const persisted = await repository.upsertMentions(mentions, {
    agencyId: input.agencyId,
    fetchedCount: result.items.length,
    sourceWindow: `${input.from}/${input.to}`,
    startedAt,
    finishedAt: new Date().toISOString()
  });
  await enqueueAlerts(persisted.createdAlerts, queueClient);

  return persisted;
};

export const importBrandwatchExportObject = async (
  input: ImportObjectInput,
  s3Client = new S3Client({}),
  queueClient = new SQSClient({})
) => {
  const repository = getRepository();
  await repository.ready();

  if (!repository.importBrandwatchWorkbook) {
    throw new Error(
      "Current repository does not support Brandwatch workbook imports"
    );
  }

  const agencyId =
    input.agencyId ??
    resolveAgencyIdFromImportKey(input.key) ??
    loadConfig().NEXT_PUBLIC_DEFAULT_AGENCY_ID;
  const workbookBuffer = await readObjectBody(
    s3Client,
    input.bucket,
    input.key
  );
  const workbook = loadBrandwatchExportWorkbookFromBuffer(workbookBuffer);
  const normalized = normalizeBrandwatchExportWorkbook(
    agencyId,
    workbook,
    `s3://${input.bucket}/${input.key}`,
    path.basename(input.key)
  );

  const result = await repository.importBrandwatchWorkbook(normalized);
  await enqueueAlerts(result.createdAlerts, queueClient);

  return {
    ...result,
    agencyId,
    bucket: input.bucket,
    key: input.key
  };
};
