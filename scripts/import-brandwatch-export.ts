import path from "node:path";

import {
  loadBrandwatchExportWorkbookFromFile,
  normalizeBrandwatchExportWorkbook
} from "@sac/brandwatch";
import { getRepository } from "@sac/db";

type Args = {
  agencyId: string;
  filePath: string;
  rawObjectKey?: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  let filePath = "";
  let agencyId = "pr-central";
  let rawObjectKey: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current) {
      continue;
    }

    if (current === "--agency" && args[index + 1]) {
      agencyId = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--raw-object-key" && args[index + 1]) {
      rawObjectKey = args[index + 1]!;
      index += 1;
      continue;
    }

    if (!current.startsWith("--") && !filePath) {
      filePath = current;
    }
  }

  if (!filePath) {
    throw new Error(
      "Usage: pnpm brandwatch:import <xlsx-path> [--agency pr-central] [--raw-object-key s3://...]"
    );
  }

  return {
    agencyId,
    filePath,
    rawObjectKey
  };
};

const main = async () => {
  const { agencyId, filePath, rawObjectKey } = parseArgs();
  const repository = getRepository();

  if (!repository.importBrandwatchWorkbook) {
    throw new Error(
      "Current repository does not support Brandwatch workbook imports"
    );
  }

  await repository.ready();

  const workbook = await loadBrandwatchExportWorkbookFromFile(filePath);
  const objectKey =
    rawObjectKey ??
    `imports/brandwatch/${agencyId}/${new Date().toISOString().slice(0, 10).replaceAll("-", "/")}/${path.basename(filePath)}`;
  const input = normalizeBrandwatchExportWorkbook(
    agencyId,
    workbook,
    objectKey,
    path.basename(filePath)
  );
  const result = await repository.importBrandwatchWorkbook(input);

  console.log(
    JSON.stringify(
      {
        agencyId,
        filePath,
        rawObjectKey: objectKey,
        result
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
