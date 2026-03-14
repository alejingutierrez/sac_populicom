import assert from "node:assert/strict";
import test from "node:test";

import * as cdk from "../../../node_modules/aws-cdk-lib/index.js";
import { Template } from "../../../node_modules/aws-cdk-lib/assertions/index.js";

import { SacPlatformStack } from "../lib/sac-platform-stack";

test("SacPlatformStack provisions the core SAC platform resources", () => {
  const app = new cdk.App();
  const stack = new SacPlatformStack(app, "TestStack", {
    env: {
      account: "123456789012",
      region: "us-east-1"
    },
    repositoryOwner: "alejingutierrez",
    repositoryName: "sac_populicom",
    githubTokenSecretName: "github/sac-populicom/token",
    alertsFromEmail: "alertas@sac.populicom.pr",
    rawBucketName: "sac-populicom-raw-test",
    exportsBucketName: "sac-populicom-exports-test",
    defaultAgencyId: "pr-central"
  });
  const template = Template.fromStack(stack);

  assert.doesNotThrow(() => template.resourceCountIs("AWS::S3::Bucket", 2));
  assert.doesNotThrow(() => template.resourceCountIs("AWS::Lambda::Function", 3));
  assert.doesNotThrow(() => template.resourceCountIs("AWS::Cognito::UserPool", 1));
  assert.doesNotThrow(() => template.resourceCountIs("AWS::RDS::DBInstance", 1));
});
