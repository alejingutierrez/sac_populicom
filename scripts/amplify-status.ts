import {
  GetAppCommand,
  GetBranchCommand,
  ListJobsCommand,
  AmplifyClient
} from "@aws-sdk/client-amplify";

type CliArgs = {
  appId: string;
  branchName: string;
  region: string;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let appId = process.env.AMPLIFY_APP_ID ?? "";
  let branchName = process.env.AMPLIFY_BRANCH_NAME ?? "main";
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

    if (current === "--region" && args[index + 1]) {
      region = args[index + 1]!;
      index += 1;
    }
  }

  if (!appId) {
    throw new Error(
      "Usage: pnpm amplify:status --app <appId> [--branch main] [--region us-east-1]"
    );
  }

  return {
    appId,
    branchName,
    region
  };
};

const main = async () => {
  const args = parseArgs();
  const client = new AmplifyClient({ region: args.region });
  const [appResponse, branchResponse, jobsResponse] = await Promise.all([
    client.send(new GetAppCommand({ appId: args.appId })),
    client.send(
      new GetBranchCommand({ appId: args.appId, branchName: args.branchName })
    ),
    client.send(
      new ListJobsCommand({
        appId: args.appId,
        branchName: args.branchName,
        maxResults: 5
      })
    )
  ]);

  console.log(
    JSON.stringify(
      {
        app: {
          appId: appResponse.app?.appId,
          name: appResponse.app?.name,
          repository: appResponse.app?.repository,
          defaultDomain: appResponse.app?.defaultDomain,
          platform: appResponse.app?.platform,
          updateTime: appResponse.app?.updateTime
        },
        branch: {
          branchName: branchResponse.branch?.branchName,
          stage: branchResponse.branch?.stage,
          enableAutoBuild: branchResponse.branch?.enableAutoBuild,
          activeJobId: branchResponse.branch?.activeJobId,
          totalNumberOfJobs: branchResponse.branch?.totalNumberOfJobs,
          updateTime: branchResponse.branch?.updateTime
        },
        jobs: (jobsResponse.jobSummaries ?? []).map((job) => ({
          jobId: job.jobId,
          jobType: job.jobType,
          status: job.status,
          sourceUrl: job.sourceUrl,
          commitId: job.commitId,
          commitMessage: job.commitMessage,
          startTime: job.startTime,
          endTime: job.endTime
        }))
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
