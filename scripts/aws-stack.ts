import { readFile } from "node:fs/promises";

import {
  CloudFormationClient,
  DescribeStackResourcesCommand
} from "@aws-sdk/client-cloudformation";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

export type StackLambdaArgs = {
  stackName: string;
  logicalIdPrefix: string;
  payload?: unknown;
  payloadFile?: string;
  region: string;
};

type StackLambdaResource = {
  logicalResourceId: string;
  physicalResourceId: string;
};

export const decodeLambdaPayload = (payload?: Uint8Array) => {
  if (!payload) {
    return null;
  }

  const text = Buffer.from(payload).toString("utf8");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const resolvePayloadInput = async (
  payload?: string,
  payloadFile?: string
) => {
  if (payloadFile) {
    return JSON.parse(await readFile(payloadFile, "utf8")) as unknown;
  }

  if (!payload) {
    return undefined;
  }

  return JSON.parse(payload) as unknown;
};

export const findStackLambda = async (
  region: string,
  stackName: string,
  logicalIdPrefix: string
) => {
  const client = new CloudFormationClient({ region });
  const response = await client.send(
    new DescribeStackResourcesCommand({ StackName: stackName })
  );
  const lambdaResources = (response.StackResources ?? [])
    .filter((resource) => resource.ResourceType === "AWS::Lambda::Function")
    .map(
      (resource) =>
        ({
          logicalResourceId: resource.LogicalResourceId ?? "",
          physicalResourceId: resource.PhysicalResourceId ?? ""
        }) satisfies StackLambdaResource
    );

  const match = lambdaResources.find((resource) =>
    resource.logicalResourceId.startsWith(logicalIdPrefix)
  );
  if (!match?.physicalResourceId) {
    throw new Error(
      `Unable to resolve Lambda with prefix ${logicalIdPrefix} in stack ${stackName}`
    );
  }

  return match;
};

export const invokeStackLambda = async ({
  stackName,
  logicalIdPrefix,
  payload,
  payloadFile,
  region
}: StackLambdaArgs) => {
  const lambdaResource = await findStackLambda(
    region,
    stackName,
    logicalIdPrefix
  );
  const lambdaClient = new LambdaClient({ region });
  const requestPayload =
    payloadFile || payload === undefined
      ? await resolvePayloadInput(undefined, payloadFile)
      : typeof payload === "string"
        ? await resolvePayloadInput(payload)
        : payload;

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: lambdaResource.physicalResourceId,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(requestPayload ?? {}))
    })
  );

  return {
    functionName: lambdaResource.physicalResourceId,
    logicalResourceId: lambdaResource.logicalResourceId,
    statusCode: response.StatusCode,
    functionError: response.FunctionError,
    payload: decodeLambdaPayload(response.Payload)
  };
};
