import path from "node:path";
import { fileURLToPath } from "node:url";

import * as amplify from "aws-cdk-lib/aws-amplify";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SacPlatformStackProps = cdk.StackProps & {
  repositoryOwner: string;
  repositoryName: string;
  githubTokenSecretName: string;
  alertsFromEmail: string;
  rawBucketName: string;
  exportsBucketName: string;
  defaultAgencyId: string;
  samlMetadataUrl?: string;
};

export class SacPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SacPlatformStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "SacVpc", {
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 24,
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        {
          cidrMask: 28,
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, "LambdaSecurityGroup", {
      vpc,
      description: "Outbound access for SAC service Lambdas."
    });

    const databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      description: "PostgreSQL access for SAC services."
    });
    databaseSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(5432), "Allow Lambda access to PostgreSQL");

    const rawBucket = new s3.Bucket(this, "RawBucket", {
      bucketName: props.rawBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(45)
            }
          ]
        }
      ]
    });

    const exportsBucket = new s3.Bucket(this, "ExportsBucket", {
      bucketName: props.exportsBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90)
        }
      ]
    });

    const brandwatchSecret = new secretsmanager.Secret(this, "BrandwatchSecret", {
      secretName: "brandwatch/prod/api",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiBaseUrl: "https://api.brandwatch.com"
        }),
        generateStringKey: "token"
      }
    });

    const githubAccessToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GithubAmplifyToken",
      props.githubTokenSecretName
    );

    const databaseCredentials = new rds.DatabaseSecret(this, "DatabaseCredentials", {
      username: "sac_populicom"
    });

    const database = new rds.DatabaseInstance(this, "SacDatabase", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16
      }),
      databaseName: "sac_populicom",
      credentials: rds.Credentials.fromSecret(databaseCredentials),
      allocatedStorage: 100,
      maxAllocatedStorage: 200,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      securityGroups: [databaseSecurityGroup],
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      cloudwatchLogsExports: ["postgresql"],
      publiclyAccessible: false
    });

    const deadLetterQueue = new sqs.Queue(this, "AlertsDlq", {
      retentionPeriod: cdk.Duration.days(14)
    });

    const alertsQueue = new sqs.Queue(this, "AlertsQueue", {
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue
      }
    });

    const userPool = new cognito.UserPool(this, "SacUserPool", {
      userPoolName: "sac-populicom-users",
      selfSignUpEnabled: false,
      signInAliases: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        },
        fullname: {
          required: true,
          mutable: true
        }
      }
    });

    const userPoolClient = userPool.addClient("SacUserPoolClient", {
      authFlows: {
        userSrp: true,
        userPassword: false
      },
      oAuth: {
        callbackUrls: ["https://main.dxxxxxxxx.amplifyapp.com/api/auth/callback/cognito"],
        logoutUrls: ["https://main.dxxxxxxxx.amplifyapp.com"]
      }
    });

    ["admin", "analista", "lector"].forEach((role) => {
      new cognito.CfnUserPoolGroup(this, `Role${role}`, {
        groupName: role,
        userPoolId: userPool.userPoolId
      });
    });

    if (props.samlMetadataUrl) {
      new cognito.UserPoolIdentityProviderSaml(this, "InstitutionalSaml", {
        userPool,
        metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(props.samlMetadataUrl),
        name: "institutional-saml",
        attributeMapping: {
          email: cognito.ProviderAttribute.other("email"),
          fullname: cognito.ProviderAttribute.other("name")
        }
      });
    }

    const lambdaEnvironment = {
      APP_ENV: "production",
      AWS_REGION: props.env?.region ?? cdk.Aws.REGION,
      ALERTS_FROM_EMAIL: props.alertsFromEmail,
      BRANDWATCH_SECRET_ARN: brandwatchSecret.secretArn,
      DATABASE_NAME: "sac_populicom",
      DATABASE_SECRET_ARN: database.secret?.secretArn ?? databaseCredentials.secretArn,
      DEFAULT_TIME_ZONE: "America/Puerto_Rico",
      EXPORTS_BUCKET_NAME: exportsBucket.bucketName,
      NEXT_PUBLIC_DEFAULT_AGENCY_ID: props.defaultAgencyId,
      RAW_BUCKET_NAME: rawBucket.bucketName
    };

    const ingestionFunction = new lambdaNodejs.NodejsFunction(this, "IngestionFunction", {
      entry: path.resolve(__dirname, "../../../services/ingestion/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment,
        ALERTS_QUEUE_URL: alertsQueue.queueUrl
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        sourceMap: true
      },
      vpc,
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });

    const notificationsFunction = new lambdaNodejs.NodejsFunction(this, "NotificationsFunction", {
      entry: path.resolve(__dirname, "../../../services/notifications/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        sourceMap: true
      },
      vpc,
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });

    const exportsFunction = new lambdaNodejs.NodejsFunction(this, "ExportsFunction", {
      entry: path.resolve(__dirname, "../../../services/exports/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        ...lambdaEnvironment
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        sourceMap: true
      },
      vpc,
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });

    rawBucket.grantReadWrite(ingestionFunction);
    exportsBucket.grantReadWrite(exportsFunction);
    alertsQueue.grantSendMessages(ingestionFunction);
    alertsQueue.grantConsumeMessages(notificationsFunction);
    brandwatchSecret.grantRead(ingestionFunction);
    database.secret?.grantRead(ingestionFunction);
    database.secret?.grantRead(notificationsFunction);
    database.secret?.grantRead(exportsFunction);

    [ingestionFunction, notificationsFunction, exportsFunction].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"]
        })
      );
    });

    notificationsFunction.addEventSourceMapping("AlertsQueueMapping", {
      batchSize: 10,
      eventSourceArn: alertsQueue.queueArn
    });

    new events.Rule(this, "IngestionSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [
        new eventsTargets.LambdaFunction(ingestionFunction, {
          event: events.RuleTargetInput.fromObject({
            agencyId: props.defaultAgencyId
          })
        })
      ]
    });

    const amplifyApp = new amplify.CfnApp(this, "SacAmplifyApp", {
      name: "sac-populicom-web",
      repository: `https://github.com/${props.repositoryOwner}/${props.repositoryName}`,
      accessToken: githubAccessToken.secretValue.toString(),
      buildSpec: [
        "version: 1",
        "applications:",
        "  - appRoot: apps/web",
        "    frontend:",
        "      phases:",
        "        preBuild:",
        "          commands:",
        "            - corepack enable",
        "            - pnpm install --frozen-lockfile",
        "        build:",
        "          commands:",
        "            - pnpm --filter @sac/web build",
        "      artifacts:",
        "        baseDirectory: .next",
        "        files:",
        "          - '**/*'"
      ].join("\n"),
      environmentVariables: [
        {
          name: "AWS_REGION",
          value: props.env?.region ?? cdk.Aws.REGION
        },
        {
          name: "NEXT_PUBLIC_APP_NAME",
          value: "SAC Populicom"
        }
      ]
    });

    new amplify.CfnBranch(this, "MainBranch", {
      appId: amplifyApp.attrAppId,
      branchName: "main",
      stage: "PRODUCTION",
      enableAutoBuild: false
    });

    new cloudwatch.Alarm(this, "IngestionErrorsAlarm", {
      metric: ingestionFunction.metricErrors(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Errores en la ingesta programada de Brandwatch."
    });

    new cloudwatch.Alarm(this, "AlertsQueueDepthAlarm", {
      metric: alertsQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 25,
      evaluationPeriods: 1,
      alarmDescription: "Cola de alertas con backlog operativo."
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId
    });

    new cdk.CfnOutput(this, "RawBucketName", {
      value: rawBucket.bucketName
    });

    new cdk.CfnOutput(this, "ExportsBucketName", {
      value: exportsBucket.bucketName
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret?.secretArn ?? databaseCredentials.secretArn
    });

    new cdk.CfnOutput(this, "AmplifyAppId", {
      value: amplifyApp.attrAppId
    });
  }
}
