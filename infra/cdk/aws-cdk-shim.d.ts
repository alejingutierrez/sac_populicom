declare module "aws-cdk-lib" {
  export const App: any;
  export const Aws: any;
  export const CfnOutput: any;
  export const Duration: any;
  export const RemovalPolicy: any;
  export const Stack: any;
  export type StackProps = any;
}

declare module "aws-cdk-lib/assertions" {
  export const Template: any;
}

declare module "aws-cdk-lib/aws-amplify" {
  const amplify: any;
  export = amplify;
}

declare module "aws-cdk-lib/aws-cloudwatch" {
  const cloudwatch: any;
  export = cloudwatch;
}

declare module "aws-cdk-lib/aws-cognito" {
  const cognito: any;
  export = cognito;
}

declare module "aws-cdk-lib/aws-ec2" {
  const ec2: any;
  export = ec2;
}

declare module "aws-cdk-lib/aws-events" {
  const events: any;
  export = events;
}

declare module "aws-cdk-lib/aws-events-targets" {
  const targets: any;
  export = targets;
}

declare module "aws-cdk-lib/aws-iam" {
  const iam: any;
  export = iam;
}

declare module "aws-cdk-lib/aws-lambda" {
  const lambda: any;
  export = lambda;
}

declare module "aws-cdk-lib/aws-lambda-nodejs" {
  const lambdaNodejs: any;
  export = lambdaNodejs;
}

declare module "aws-cdk-lib/aws-logs" {
  const logs: any;
  export = logs;
}

declare module "aws-cdk-lib/aws-rds" {
  const rds: any;
  export = rds;
}

declare module "aws-cdk-lib/aws-s3" {
  const s3: any;
  export = s3;
}

declare module "aws-cdk-lib/aws-secretsmanager" {
  const secretsmanager: any;
  export = secretsmanager;
}

declare module "aws-cdk-lib/aws-sqs" {
  const sqs: any;
  export = sqs;
}
