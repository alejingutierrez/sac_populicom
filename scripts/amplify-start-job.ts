import {
  AmplifyClient,
  StartJobCommand,
  type JobType
} from "@aws-sdk/client-amplify";

type CliArgs = {
  appId: string;
  branchName: string;
  jobType: JobType;
  region: string;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let appId = process.env.AMPLIFY_APP_ID ?? "";
  let branchName = process.env.AMPLIFY_BRANCH_NAME ?? "main";
  let jobType: JobType = "RELEASE";
  let region =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current) {
      continue;
    }

    if (current === "--app" && args[index + 1]) {
      appId = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--branch" && args[index + 1]) {
      branchName = args[index + 1]!;
      index += 1;
      continue;
    }

    if (current === "--job-type" && args[index + 1]) {
      jobType = args[index + 1]!.toUpperCase() as JobType;
      index += 1;
      continue;
    }

    if (current === "--region" && args[index + 1]) {
      region = args[index + 1]!;
      index += 1;
    }
  }

  if (!appId) {
    throw new Error(
      "Usage: pnpm amplify:start-job --app <appId> [--branch main] [--job-type RELEASE]"
    );
  }

  return {
    appId,
    branchName,
    jobType,
    region
  };
};

const main = async () => {
  const args = parseArgs();
  const client = new AmplifyClient({ region: args.region });
  const response = await client.send(
    new StartJobCommand({
      appId: args.appId,
      branchName: args.branchName,
      jobType: args.jobType
    })
  );

  console.log(
    JSON.stringify(
      {
        jobSummary: {
          jobId: response.jobSummary?.jobId,
          jobArn: response.jobSummary?.jobArn,
          jobType: response.jobSummary?.jobType,
          status: response.jobSummary?.status
        }
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
