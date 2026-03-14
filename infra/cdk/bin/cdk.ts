#!/usr/bin/env node
import "source-map-support/register";

import * as cdk from "aws-cdk-lib";

import { loadConfig } from "@sac/config";

import { SacPlatformStack } from "../lib/sac-platform-stack";

const app = new cdk.App();
const config = loadConfig();

new SacPlatformStack(app, "SacPlatformProd", {
  env: {
    account: config.AWS_ACCOUNT_ID,
    region: config.AWS_REGION
  },
  description:
    "Base técnica inicial SAC Populicom para monitoreo multiagencia en Puerto Rico.",
  repositoryName: config.GITHUB_REPOSITORY_NAME,
  repositoryOwner: config.GITHUB_REPOSITORY_OWNER,
  githubTokenSecretName: config.GITHUB_ACCESS_TOKEN_SECRET_NAME,
  alertsFromEmail: config.ALERTS_FROM_EMAIL,
  rawBucketName: config.RAW_BUCKET_NAME,
  exportsBucketName: config.EXPORTS_BUCKET_NAME,
  defaultAgencyId: config.NEXT_PUBLIC_DEFAULT_AGENCY_ID,
  importsPrefix: config.BRANDWATCH_IMPORT_PREFIX,
  webBaseUrl: config.AMPLIFY_APP_URL ?? config.NEXT_PUBLIC_BASE_URL,
  amplifyBranchName: config.AMPLIFY_BRANCH_NAME,
  existingAmplifyAppId: config.AMPLIFY_APP_ID,
  samlMetadataUrl: config.COGNITO_SAML_METADATA_URL
});
