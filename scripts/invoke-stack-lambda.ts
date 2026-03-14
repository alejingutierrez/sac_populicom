import { invokeStackLambda } from "./aws-stack";

type CliArgs = {
  logicalIdPrefix: string;
  payload?: string;
  payloadFile?: string;
  region: string;
  stackName: string;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let logicalIdPrefix = "";
  let payload: string | undefined;
  let payloadFile: string | undefined;
  let region =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  let stackName = "SacPlatformProd";

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current) {
      continue;
    }

    if (current === "--prefix" && args[index + 1]) {
      logicalIdPrefix = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--payload" && args[index + 1]) {
      payload = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--payload-file" && args[index + 1]) {
      payloadFile = args[index + 1]!;
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

  if (!logicalIdPrefix) {
    throw new Error(
      "Usage: pnpm stack:invoke-lambda --prefix <LogicalIdPrefix> [--stack SacPlatformProd] [--payload '{...}']"
    );
  }

  return {
    logicalIdPrefix,
    payload,
    payloadFile,
    region,
    stackName
  };
};

const main = async () => {
  const args = parseArgs();
  const result = await invokeStackLambda(args);
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
