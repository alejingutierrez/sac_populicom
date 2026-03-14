import { invokeStackLambda } from "./aws-stack";

type CliArgs = {
  agencyId?: string;
  bucket: string;
  key: string;
  region: string;
  stackName: string;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let agencyId: string | undefined;
  let bucket = "";
  let key = "";
  let region =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  let stackName = "SacPlatformProd";

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

    if (current === "--bucket" && args[index + 1]) {
      bucket = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--key" && args[index + 1]) {
      key = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--region" && args[index + 1]) {
      region = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--stack" && args[index + 1]) {
      stackName = args[index + 1]!;
      index += 1;
    }
  }

  if (!bucket || !key) {
    throw new Error(
      "Usage: pnpm brandwatch:invoke-import --bucket <bucket> --key <s3-key> [--agency pr-central] [--stack SacPlatformProd]"
    );
  }

  return {
    agencyId,
    bucket,
    key,
    region,
    stackName
  };
};

const main = async () => {
  const { agencyId, bucket, key, region, stackName } = parseArgs();
  const s3Record = {
    s3: {
      bucket: { name: bucket },
      object: { key: encodeURIComponent(key).replaceAll("%2F", "/") }
    }
  };

  const payload = {
    Records: [
      {
        body: JSON.stringify({
          Records: [s3Record]
        })
      }
    ]
  };

  const result = await invokeStackLambda({
    stackName,
    logicalIdPrefix: "IngestionFunction",
    payload,
    region
  });

  const output =
    agencyId && Array.isArray(result.payload)
      ? result.payload.map((entry) => ({
          ...(typeof entry === "object" && entry ? entry : {}),
          agencyId
        }))
      : result.payload;

  console.log(
    JSON.stringify(
      {
        ...result,
        payload: output
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
