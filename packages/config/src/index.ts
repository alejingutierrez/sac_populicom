import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCOUNT_ID: z.string().default("863956448838"),
  DEFAULT_TIME_ZONE: z.string().default("America/Puerto_Rico"),
  DEFAULT_LOCALE: z.string().default("es-PR"),
  NEXT_PUBLIC_APP_NAME: z.string().default("SAC Populicom"),
  NEXT_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_AGENCY_ID: z.string().default("pr-central"),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  BRANDWATCH_SECRET_ARN: z.string().default("brandwatch/prod/api"),
  BRANDWATCH_IMPORT_PREFIX: z.string().default("imports/brandwatch"),
  RAW_BUCKET_NAME: z.string().default("sac-populicom-raw"),
  EXPORTS_BUCKET_NAME: z.string().default("sac-populicom-exports"),
  ALERTS_FROM_EMAIL: z.string().default("alertas@sac.populicom.pr"),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_USER_POOL_CLIENT_ID: z.string().optional(),
  COGNITO_SAML_METADATA_URL: z.string().optional(),
  AMPLIFY_APP_ID: z.string().optional(),
  AMPLIFY_BRANCH_NAME: z.string().default("main"),
  AMPLIFY_APP_URL: z.string().optional(),
  GITHUB_REPOSITORY_OWNER: z.string().default("alejingutierrez"),
  GITHUB_REPOSITORY_NAME: z.string().default("sac_populicom"),
  GITHUB_ACCESS_TOKEN_SECRET_NAME: z
    .string()
    .default("github/sac-populicom/token")
});

export type AppConfig = z.infer<typeof environmentSchema>;

export const loadConfig = (
  source: Record<string, string | undefined> = process.env
): AppConfig => environmentSchema.parse(source);

export const getPublicConfig = (
  source: Record<string, string | undefined> = process.env
) => {
  const config = loadConfig(source);

  return {
    appName: config.NEXT_PUBLIC_APP_NAME,
    baseUrl: config.NEXT_PUBLIC_BASE_URL,
    defaultAgencyId: config.NEXT_PUBLIC_DEFAULT_AGENCY_ID,
    locale: config.DEFAULT_LOCALE,
    timeZone: config.DEFAULT_TIME_ZONE
  };
};
