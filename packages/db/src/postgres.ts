import { randomUUID } from "node:crypto";

import {
  canAcknowledgeAlerts,
  canManageCases,
  type SessionContext
} from "@sac/auth";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import {
  buildMentionEnrichedViewSql,
  buildRollup24hViewSql,
  buildRollup7dViewSql,
  buildRollupBatchViewSql,
  enrichmentDefinitions
} from "./enrichments";
import {
  buildExplorationBreakdowns,
  buildExplorationEntities,
  buildExplorationHeatmap,
  buildExplorationMentionRows,
  buildExplorationMeta,
  buildExplorationScatter,
  buildExplorationSummary,
  buildExplorationTimeseries,
  filterExplorationMentions,
  resolveExplorationGranularity
} from "./exploration";
import {
  assertCaseTransition,
  createAlertFromMention,
  createId,
  createSeedData,
  now
} from "./seed";
import type {
  Agency,
  Alert,
  BrandwatchWorkbookImportInput,
  Case,
  EnrichedMention,
  EnrichmentDefinition,
  EnrichmentRollup,
  EnrichmentRollupFilters,
  ExplorationFilters,
  ExplorationMentionListOptions,
  ImportResult,
  NormalizedMention,
  Repository,
  SavedFilter,
  User
} from "./types";

const schemaSql = `
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  UNIQUE (user_id, agency_id, role)
);

CREATE TABLE IF NOT EXISTS source_queries (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  report_name TEXT NOT NULL,
  label TEXT,
  source_from TIMESTAMPTZ NOT NULL,
  source_to TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_id, name)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  source_query_id TEXT NOT NULL REFERENCES source_queries(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  s3_key TEXT NOT NULL,
  raw_object_key TEXT NOT NULL,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_deduped INTEGER NOT NULL DEFAULT 0,
  mentions_upserted INTEGER NOT NULL DEFAULT 0,
  metrics_inserted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  source_author_id TEXT,
  name TEXT,
  handle TEXT,
  full_name TEXT,
  account_type TEXT,
  verified_type TEXT,
  avatar_url TEXT,
  followers DOUBLE PRECISION,
  following DOUBLE PRECISION,
  posts DOUBLE PRECISION,
  raw_profile JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  source_publication_id TEXT,
  name TEXT,
  domain TEXT,
  page_type TEXT,
  pub_type TEXT,
  publisher_subtype TEXT,
  blog_name TEXT,
  subreddit TEXT,
  subscribers DOUBLE PRECISION,
  daily_visitors DOUBLE PRECISION,
  total_monthly_visitors DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mention_threads (
  id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  source_thread_id TEXT,
  parent_post_id TEXT,
  root_post_id TEXT,
  thread_url TEXT,
  thread_author TEXT,
  thread_created_at TIMESTAMPTZ,
  entry_type TEXT,
  parent_blog_name TEXT,
  root_blog_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geographies (
  id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  continent_code TEXT,
  continent TEXT,
  country_code TEXT,
  country TEXT,
  region_code TEXT,
  region TEXT,
  city_code TEXT,
  city TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  source_query_id TEXT REFERENCES source_queries(id) ON DELETE SET NULL,
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
  author_id TEXT REFERENCES authors(id) ON DELETE SET NULL,
  publication_id TEXT REFERENCES publications(id) ON DELETE SET NULL,
  thread_id TEXT REFERENCES mention_threads(id) ON DELETE SET NULL,
  geography_id TEXT REFERENCES geographies(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'brandwatch_api',
  channel TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  priority TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_handle TEXT,
  topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  raw_object_key TEXT,
  engagement JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, external_id, source_system)
);

CREATE INDEX IF NOT EXISTS mentions_agency_occurred_at_idx ON mentions (agency_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mentions_import_batch_idx ON mentions (import_batch_id);
CREATE INDEX IF NOT EXISTS mentions_source_query_idx ON mentions (source_query_id);
CREATE INDEX IF NOT EXISTS mentions_author_idx ON mentions (author_id);
CREATE INDEX IF NOT EXISTS mentions_publication_idx ON mentions (publication_id);
CREATE INDEX IF NOT EXISTS mentions_thread_idx ON mentions (thread_id);
CREATE INDEX IF NOT EXISTS mentions_external_idx ON mentions (external_id);

CREATE TABLE IF NOT EXISTS mention_raw_rows (
  id TEXT PRIMARY KEY,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  mention_id TEXT REFERENCES mentions(id) ON DELETE SET NULL,
  row_number INTEGER NOT NULL,
  query_id TEXT NOT NULL,
  source_mention_id TEXT,
  resource_id TEXT,
  canonical_external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  page_type TEXT,
  content_source_name TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_batch_id, row_number)
);

CREATE INDEX IF NOT EXISTS mention_raw_rows_mention_created_idx ON mention_raw_rows (mention_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mention_raw_rows_query_idx ON mention_raw_rows (query_id);

CREATE TABLE IF NOT EXISTS mention_metrics (
  id TEXT PRIMARY KEY,
  mention_id TEXT NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  platform TEXT NOT NULL,
  source_column TEXT NOT NULL,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mention_metrics_mention_idx ON mention_metrics (mention_id);

CREATE TABLE IF NOT EXISTS mention_attributes (
  id TEXT PRIMARY KEY,
  mention_id TEXT NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  value_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  source_column TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mention_attributes_mention_idx ON mention_attributes (mention_id);

CREATE TABLE IF NOT EXISTS enrichment_definitions (
  code TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  grain TEXT NOT NULL,
  value_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  depends_on JSONB NOT NULL,
  source_coverage TEXT NOT NULL,
  null_policy TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  mention_id TEXT NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  mention_id TEXT REFERENCES mentions(id) ON DELETE SET NULL,
  alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigned_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS brandwatch_sync_runs (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  source_window TEXT NOT NULL,
  fetched_count INTEGER NOT NULL,
  inserted_count INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

type PoolHolder = typeof globalThis & {
  __sacPgPool?: Pool;
  __sacPgReady?: Promise<void>;
};

const holder = globalThis as PoolHolder;

const configuredDatabaseUrl = () => process.env.DATABASE_URL?.trim();

export const isDatabaseConfigured = () => Boolean(configuredDatabaseUrl());

const getPool = () => {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL repository");
  }

  if (!holder.__sacPgPool) {
    holder.__sacPgPool = new Pool({
      connectionString,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false }
    });
  }

  return holder.__sacPgPool;
};

const cleanText = (value?: string | null) =>
  value && value.trim() ? value.trim() : undefined;
const normalizeIdentity = (...values: Array<string | undefined>) =>
  values.map((value) => cleanText(value)?.toLowerCase() ?? "").join("|");

const toIsoString = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapMention = (row: MentionRow): NormalizedMention => ({
  id: row.id,
  agencyId: row.agency_id,
  externalId: row.external_id,
  source: row.source,
  sourceSystem: row.source_system,
  channel: row.channel,
  title: row.title ?? undefined,
  body: row.body,
  url: row.url,
  language: row.language,
  sentiment: row.sentiment,
  priority: row.priority,
  authorName: row.author_name,
  authorHandle: row.author_handle ?? undefined,
  topics: row.topics ?? [],
  keywords: row.keywords ?? [],
  occurredAt: toIsoString(row.occurred_at),
  receivedAt: toIsoString(row.received_at),
  isCritical: row.is_critical,
  rawObjectKey: row.raw_object_key ?? undefined,
  engagement: row.engagement ?? {
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0
  }
});

const visibleAgencyIds = (session: SessionContext) =>
  session.role === "admin" ? undefined : session.agencyIds;

const seedOperationalData = async (client: PoolClient) => {
  const seed = createSeedData();

  for (const agency of seed.agencies) {
    await client.query(
      `
        INSERT INTO agencies (id, slug, name, is_active, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE
        SET slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
      `,
      [agency.id, agency.slug, agency.name, agency.isActive]
    );
  }

  for (const user of seed.users) {
    await client.query(
      `
        INSERT INTO users (id, email, display_name, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            updated_at = NOW()
      `,
      [user.id, user.email, user.displayName]
    );

    for (const agencyId of user.agencyIds) {
      await client.query(
        `
          INSERT INTO user_roles (id, user_id, agency_id, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, agency_id, role) DO NOTHING
        `,
        [createId("role"), user.id, agencyId, user.role]
      );
    }
  }
};

const syncEnrichmentDefinitions = async (client: PoolClient) => {
  for (const definition of enrichmentDefinitions) {
    await client.query(
      `
        INSERT INTO enrichment_definitions (code, slug, label, category, grain, value_type, is_enabled, depends_on, source_coverage, null_policy, description, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,NOW())
        ON CONFLICT (code) DO UPDATE
        SET slug = EXCLUDED.slug,
            label = EXCLUDED.label,
            category = EXCLUDED.category,
            grain = EXCLUDED.grain,
            value_type = EXCLUDED.value_type,
            depends_on = EXCLUDED.depends_on,
            source_coverage = EXCLUDED.source_coverage,
            null_policy = EXCLUDED.null_policy,
            description = EXCLUDED.description,
            updated_at = NOW()
      `,
      [
        definition.code,
        definition.slug,
        definition.label,
        definition.category,
        definition.grain,
        definition.valueType,
        definition.isEnabled,
        JSON.stringify(definition.dependsOn),
        definition.sourceCoverage,
        definition.nullPolicy,
        definition.description
      ]
    );
  }
};

const ensureEnrichmentArtifacts = async (client: PoolClient) => {
  await syncEnrichmentDefinitions(client);
  await client.query(buildMentionEnrichedViewSql());
  await client.query(buildRollup24hViewSql());
  await client.query(buildRollup7dViewSql());
  await client.query(buildRollupBatchViewSql());
};

const ensureReady = async () => {
  if (!holder.__sacPgReady) {
    holder.__sacPgReady = (async () => {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query(schemaSql);
        await seedOperationalData(client);
        await ensureEnrichmentArtifacts(client);
      } finally {
        client.release();
      }
    })();
  }

  await holder.__sacPgReady;
};

const upsertDimension = async (
  client: PoolClient,
  table: "authors" | "publications" | "mention_threads" | "geographies",
  identityKey: string,
  payload: Record<string, unknown>
) => {
  const id = `${table.slice(0, -1)}-${randomUUID()}`;
  const keys = Object.keys(payload);
  const values = Object.values(payload);
  const columns = ["id", "identity_key", ...keys, "created_at", "updated_at"];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updateAssignments = keys
    .map((key) => `${key} = EXCLUDED.${key}`)
    .join(", ");

  const result = await client.query<{ id: string }>(
    `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      ON CONFLICT (identity_key) DO UPDATE
      SET ${updateAssignments}, updated_at = NOW()
      RETURNING id
    `,
    [id, identityKey, ...values, now(), now()]
  );

  return result.rows[0]?.id;
};

const resolveAuthorId = async (
  client: PoolClient,
  mention: BrandwatchWorkbookImportInput["items"][number]
) => {
  if (!mention.author) {
    return undefined;
  }

  const identityKey = normalizeIdentity(
    mention.author.platform,
    mention.author.sourceAuthorId,
    mention.author.handle,
    mention.author.fullName,
    mention.author.name
  );
  if (!identityKey.replaceAll("|", "")) {
    return undefined;
  }

  return upsertDimension(client, "authors", identityKey, {
    platform: mention.author.platform,
    source_author_id: mention.author.sourceAuthorId,
    name: mention.author.name,
    handle: mention.author.handle,
    full_name: mention.author.fullName,
    account_type: mention.author.accountType,
    verified_type: mention.author.verifiedType,
    avatar_url: mention.author.avatarUrl,
    followers: mention.author.followers,
    following: mention.author.following,
    posts: mention.author.posts,
    raw_profile: mention.author.rawProfile ?? null
  });
};

const resolvePublicationId = async (
  client: PoolClient,
  mention: BrandwatchWorkbookImportInput["items"][number]
) => {
  if (!mention.publication) {
    return undefined;
  }

  const identityKey = normalizeIdentity(
    mention.publication.platform,
    mention.publication.sourcePublicationId,
    mention.publication.domain,
    mention.publication.name,
    mention.publication.subreddit,
    mention.publication.blogName
  );
  if (!identityKey.replaceAll("|", "")) {
    return undefined;
  }

  return upsertDimension(client, "publications", identityKey, {
    platform: mention.publication.platform,
    source_publication_id: mention.publication.sourcePublicationId,
    name: mention.publication.name,
    domain: mention.publication.domain,
    page_type: mention.publication.pageType,
    pub_type: mention.publication.pubType,
    publisher_subtype: mention.publication.publisherSubtype,
    blog_name: mention.publication.blogName,
    subreddit: mention.publication.subreddit,
    subscribers: mention.publication.subscribers,
    daily_visitors: mention.publication.dailyVisitors,
    total_monthly_visitors: mention.publication.totalMonthlyVisitors
  });
};

const resolveThreadId = async (
  client: PoolClient,
  mention: BrandwatchWorkbookImportInput["items"][number]
) => {
  if (!mention.thread) {
    return undefined;
  }

  const identityKey = normalizeIdentity(
    mention.thread.platform,
    mention.thread.sourceThreadId,
    mention.thread.threadUrl,
    mention.thread.parentPostId,
    mention.thread.rootPostId
  );
  if (!identityKey.replaceAll("|", "")) {
    return undefined;
  }

  return upsertDimension(client, "mention_threads", identityKey, {
    platform: mention.thread.platform,
    source_thread_id: mention.thread.sourceThreadId,
    parent_post_id: mention.thread.parentPostId,
    root_post_id: mention.thread.rootPostId,
    thread_url: mention.thread.threadUrl,
    thread_author: mention.thread.threadAuthor,
    thread_created_at: mention.thread.threadCreatedAt
      ? new Date(mention.thread.threadCreatedAt)
      : null,
    entry_type: mention.thread.entryType,
    parent_blog_name: mention.thread.parentBlogName,
    root_blog_name: mention.thread.rootBlogName
  });
};

const resolveGeographyId = async (
  client: PoolClient,
  mention: BrandwatchWorkbookImportInput["items"][number]
) => {
  if (!mention.geography) {
    return undefined;
  }

  const identityKey = normalizeIdentity(
    mention.geography.continentCode,
    mention.geography.countryCode,
    mention.geography.regionCode,
    mention.geography.cityCode,
    mention.geography.locationName
  );
  if (!identityKey.replaceAll("|", "")) {
    return undefined;
  }

  return upsertDimension(client, "geographies", identityKey, {
    continent_code: mention.geography.continentCode,
    continent: mention.geography.continent,
    country_code: mention.geography.countryCode,
    country: mention.geography.country,
    region_code: mention.geography.regionCode,
    region: mention.geography.region,
    city_code: mention.geography.cityCode,
    city: mention.geography.city,
    location_name: mention.geography.locationName,
    latitude: mention.geography.latitude,
    longitude: mention.geography.longitude
  });
};

type AlertRow = QueryResultRow & {
  id: string;
  agency_id: string;
  mention_id: string;
  title: string;
  description: string;
  severity: Alert["severity"];
  status: Alert["status"];
  created_at: Date | string;
  updated_at: Date | string;
};

type CaseRow = QueryResultRow & {
  id: string;
  agency_id: string;
  mention_id: string | null;
  alert_id: string | null;
  title: string;
  summary: string;
  status: Case["status"];
  priority: Case["priority"];
  assigned_to_id: string | null;
  created_by_id: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type AgencyRow = QueryResultRow & {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

type MentionRow = QueryResultRow & {
  id: string;
  agency_id: string;
  external_id: string;
  source: NormalizedMention["source"];
  source_system: NonNullable<NormalizedMention["sourceSystem"]>;
  channel: string;
  title: string | null;
  body: string;
  url: string;
  language: string;
  sentiment: NormalizedMention["sentiment"];
  priority: NormalizedMention["priority"];
  author_name: string;
  author_handle: string | null;
  topics: string[] | null;
  keywords: string[] | null;
  occurred_at: Date | string;
  received_at: Date | string;
  is_critical: boolean;
  raw_object_key: string | null;
  engagement: NormalizedMention["engagement"] | null;
};

type UserRoleRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  role: User["role"] | null;
  agency_id: string | null;
};

type SavedFilterRow = QueryResultRow & {
  id: string;
  agency_id: string;
  owner_id: string;
  scope: SavedFilter["scope"];
  payload: SavedFilter["payload"];
};

type DashboardSummaryRow = QueryResultRow & {
  mentions_last_24h: string | number | null;
  open_alerts: string | number | null;
  open_cases: string | number | null;
  critical_mentions: string | number | null;
  agencies_covered: string | number | null;
};

type EnrichmentDefinitionRow = QueryResultRow & {
  code: string;
  slug: string;
  label: string;
  category: EnrichmentDefinition["category"];
  grain: EnrichmentDefinition["grain"];
  value_type: EnrichmentDefinition["valueType"];
  is_enabled: boolean;
  depends_on: string[];
  source_coverage: EnrichmentDefinition["sourceCoverage"];
  null_policy: EnrichmentDefinition["nullPolicy"];
  description: string;
};

type MentionEnrichedRow = MentionRow & {
  import_batch_id: string | null;
  source_query_id: string | null;
  enrichments: Record<string, unknown> | null;
  enrichment_meta: Record<string, unknown> | null;
};

type RollupRow = QueryResultRow & {
  agency_id: string;
  batch_id: string | null;
  query_id: string | null;
  group_by: EnrichmentRollup["groupBy"];
  group_key: string;
  values: Record<string, unknown>;
};

const roleWeight = (role: User["role"] | null | undefined) => {
  switch (role) {
    case "admin":
      return 3;
    case "analista":
      return 2;
    default:
      return 1;
  }
};

const mapEnrichmentDefinition = (
  row: EnrichmentDefinitionRow
): EnrichmentDefinition => ({
  code: row.code,
  slug: row.slug,
  label: row.label,
  category: row.category,
  grain: row.grain,
  valueType: row.value_type,
  isEnabled: row.is_enabled,
  dependsOn: row.depends_on,
  sourceCoverage: row.source_coverage,
  nullPolicy: row.null_policy,
  description: row.description
});

const mapEnrichedMention = (row: MentionEnrichedRow): EnrichedMention => ({
  ...mapMention(row),
  enrichments: (row.enrichments ?? {}) as EnrichedMention["enrichments"],
  enrichmentMeta: (row.enrichment_meta ??
    undefined) as EnrichedMention["enrichmentMeta"]
});

const mapRollup = (
  row: RollupRow,
  window: EnrichmentRollupFilters["window"]
): EnrichmentRollup => ({
  agencyId: row.agency_id,
  batchId: row.batch_id ?? undefined,
  queryId: row.query_id ?? undefined,
  groupBy: row.group_by,
  groupKey: row.group_key,
  values: row.values as EnrichmentRollup["values"],
  window
});

export const createPostgresRepository = (): Repository => {
  const listEnrichmentDefinitions: Repository["listEnrichmentDefinitions"] =
    async () => {
      await ensureReady();
      const pool = getPool();
      const result = await pool.query<EnrichmentDefinitionRow>(
        `
          SELECT code, slug, label, category, grain, value_type, is_enabled, depends_on, source_coverage, null_policy, description
          FROM enrichment_definitions
          ORDER BY code ASC
        `
      );

      return result.rows.map(mapEnrichmentDefinition);
    };

  const listMentions: Repository["listMentions"] = async (
    session,
    filters = {}
  ) => {
    await ensureReady();
    const pool = getPool();
    const clauses: string[] = [];
    const params: unknown[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }

    if (filters.agencyId) {
      params.push(filters.agencyId);
      clauses.push(`agency_id = $${params.length}`);
    }
    if (filters.source) {
      params.push(filters.source);
      clauses.push(`source = $${params.length}`);
    }
    if (filters.sentiment) {
      params.push(filters.sentiment);
      clauses.push(`sentiment = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      clauses.push(`priority = $${params.length}`);
    }
    if (filters.q) {
      params.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(
        `LOWER(COALESCE(title, '') || ' ' || body || ' ' || array_to_string(keywords, ' ') || ' ' || array_to_string(topics, ' ')) LIKE $${params.length}`
      );
    }
    if (filters.from) {
      params.push(new Date(filters.from));
      clauses.push(`occurred_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(new Date(filters.to));
      clauses.push(`occurred_at <= $${params.length}`);
    }

    const result = await pool.query<MentionRow>(
      `
        SELECT *
        FROM mentions
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY occurred_at DESC
      `,
      params
    );

    return result.rows.map(mapMention);
  };

  const listMentionsEnriched: Repository["listMentionsEnriched"] = async (
    session,
    filters = {},
    options = {}
  ) => {
    await ensureReady();
    const pool = getPool();
    const clauses: string[] = [];
    const params: unknown[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }

    if (filters.agencyId) {
      params.push(filters.agencyId);
      clauses.push(`agency_id = $${params.length}`);
    }
    if (filters.source) {
      params.push(filters.source);
      clauses.push(`source = $${params.length}`);
    }
    if (filters.sentiment) {
      params.push(filters.sentiment);
      clauses.push(`sentiment = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      clauses.push(`priority = $${params.length}`);
    }
    if (filters.q) {
      params.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(
        `LOWER(COALESCE(title, '') || ' ' || body || ' ' || array_to_string(keywords, ' ') || ' ' || array_to_string(topics, ' ')) LIKE $${params.length}`
      );
    }
    if (filters.from) {
      params.push(new Date(filters.from));
      clauses.push(`occurred_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(new Date(filters.to));
      clauses.push(`occurred_at <= $${params.length}`);
    }
    let limitClause = "";
    let offsetClause = "";

    const definitions = await listEnrichmentDefinitions();
    const enabledSlugs = new Set(
      definitions
        .filter((definition) => options.includeDisabled || definition.isEnabled)
        .map((definition) => definition.slug)
    );

    if (typeof options.limit === "number") {
      params.push(options.limit);
      limitClause = `LIMIT $${params.length}`;
    }

    if (typeof options.offset === "number") {
      params.push(options.offset);
      offsetClause = `OFFSET $${params.length}`;
    }

    const result = await pool.query<MentionEnrichedRow>(
      `
        SELECT *
        FROM mention_enriched_v1
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY occurred_at DESC
        ${limitClause}
        ${offsetClause}
      `,
      params
    );

    return result.rows.map((row) => {
      const mapped = mapEnrichedMention(row);
      return {
        ...mapped,
        enrichments: Object.fromEntries(
          Object.entries(mapped.enrichments).filter(([slug]) =>
            enabledSlugs.has(slug)
          )
        )
      };
    });
  };

  const getMentionEnrichments: Repository["getMentionEnrichments"] = async (
    session,
    mentionId,
    options = {}
  ) => {
    await ensureReady();
    const pool = getPool();
    const clauses = ["id = $1"];
    const params: unknown[] = [mentionId];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }

    const definitions = await listEnrichmentDefinitions();
    const enabledSlugs = new Set(
      definitions
        .filter((definition) => options.includeDisabled || definition.isEnabled)
        .map((definition) => definition.slug)
    );

    const result = await pool.query<MentionEnrichedRow>(
      `
        SELECT *
        FROM mention_enriched_v1
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      params
    );
    const row = result.rows[0];
    const mapped = row ? mapEnrichedMention(row) : undefined;
    const mention = mapped
      ? {
          ...mapped,
          enrichments: Object.fromEntries(
            Object.entries(mapped.enrichments).filter(([slug]) =>
              enabledSlugs.has(slug)
            )
          )
        }
      : undefined;

    if (!mention) {
      throw new Error(`Mention ${mentionId} not found`);
    }
    return mention;
  };

  const listEnrichmentRollups: Repository["listEnrichmentRollups"] = async (
    session,
    filters
  ) => {
    await ensureReady();
    const pool = getPool();
    const scopedAgencyIds = visibleAgencyIds(session);
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }
    if (filters.agencyId) {
      params.push(filters.agencyId);
      clauses.push(`agency_id = $${params.length}`);
    }
    params.push(filters.groupBy);
    clauses.push(`group_by = $${params.length}`);
    if (filters.window === "batch" && filters.batchId) {
      params.push(filters.batchId);
      clauses.push(`batch_id = $${params.length}`);
    }

    const sourceView =
      filters.window === "24h"
        ? "mention_rollup_24h_v1"
        : filters.window === "7d"
          ? "mention_rollup_7d_v1"
          : "mention_rollup_batch_v1";

    const result = await pool.query<RollupRow>(
      `
        SELECT agency_id, batch_id, query_id, group_by, group_key, values
        FROM ${sourceView}
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY group_key ASC
      `,
      params
    );

    return result.rows.map((row) => mapRollup(row, filters.window));
  };

  const listAlerts: Repository["listAlerts"] = async (session, agencyId) => {
    await ensureReady();
    const pool = getPool();
    const params: unknown[] = [];
    const clauses: string[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }
    if (agencyId) {
      params.push(agencyId);
      clauses.push(`agency_id = $${params.length}`);
    }

    const result = await pool.query<AlertRow>(
      `
        SELECT id, agency_id, mention_id, title, description, severity, status, created_at, updated_at
        FROM alerts
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY created_at DESC
      `,
      params
    );

    return result.rows.map((row: AlertRow) => ({
      id: row.id,
      agencyId: row.agency_id,
      mentionId: row.mention_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    }));
  };

  const listCases: Repository["listCases"] = async (session, agencyId) => {
    await ensureReady();
    const pool = getPool();
    const params: unknown[] = [];
    const clauses: string[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }
    if (agencyId) {
      params.push(agencyId);
      clauses.push(`agency_id = $${params.length}`);
    }

    const result = await pool.query<CaseRow>(
      `
        SELECT *
        FROM cases
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY updated_at DESC
      `,
      params
    );

    return result.rows.map((row: CaseRow) => ({
      id: row.id,
      agencyId: row.agency_id,
      mentionId: row.mention_id ?? undefined,
      alertId: row.alert_id ?? undefined,
      title: row.title,
      summary: row.summary,
      status: row.status,
      priority: row.priority,
      assignedToId: row.assigned_to_id ?? undefined,
      createdById: row.created_by_id,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    }));
  };

  const listAgencies: Repository["listAgencies"] = async (session) => {
    await ensureReady();
    const pool = getPool();
    const scopedAgencyIds = visibleAgencyIds(session);
    const result = scopedAgencyIds
      ? await pool.query<AgencyRow>(
          `SELECT id, slug, name, is_active FROM agencies WHERE id = ANY($1::text[]) ORDER BY name ASC`,
          [scopedAgencyIds]
        )
      : await pool.query<AgencyRow>(
          `SELECT id, slug, name, is_active FROM agencies ORDER BY name ASC`
        );

    return result.rows.map(
      (row: AgencyRow): Agency => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        isActive: row.is_active
      })
    );
  };

  const listUsers: Repository["listUsers"] = async (session) => {
    await ensureReady();
    const pool = getPool();
    const scopedAgencyIds = visibleAgencyIds(session);
    const result = await pool.query<UserRoleRow>(
      `
        SELECT users.id, users.email, users.display_name, user_roles.role, user_roles.agency_id
        FROM users
        LEFT JOIN user_roles ON user_roles.user_id = users.id
        ORDER BY users.display_name ASC
      `
    );

    const users = new Map<
      string,
      {
        id: string;
        email: string;
        displayName: string;
        role: User["role"];
        agencyIds: Set<string>;
      }
    >();

    for (const row of result.rows) {
      const current = users.get(row.id) ?? {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: "lector" as const,
        agencyIds: new Set<string>()
      };

      if (roleWeight(row.role) > roleWeight(current.role)) {
        current.role = row.role ?? "lector";
      }
      if (row.agency_id) {
        current.agencyIds.add(row.agency_id);
      }

      users.set(row.id, current);
    }

    return Array.from(users.values())
      .filter((user) => {
        if (!scopedAgencyIds) {
          return true;
        }

        if (user.role === "admin") {
          return true;
        }

        return (
          user.agencyIds.size > 0 &&
          Array.from(user.agencyIds).some((agencyId) =>
            scopedAgencyIds.includes(agencyId)
          )
        );
      })
      .map(
        (user): User => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          agencyIds: Array.from(user.agencyIds)
        })
      );
  };

  const listSavedFilters: Repository["listSavedFilters"] = async (
    session,
    scope
  ) => {
    await ensureReady();
    const pool = getPool();
    const params: unknown[] = [];
    const clauses: string[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);
    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      clauses.push(`agency_id = ANY($${params.length}::text[])`);
    }
    if (scope) {
      params.push(scope);
      clauses.push(`scope = $${params.length}`);
    }
    if (session.role !== "admin") {
      params.push(session.userId);
      clauses.push(`owner_id = $${params.length}`);
    }

    const result = await pool.query<SavedFilterRow>(
      `
        SELECT *
        FROM saved_filters
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY updated_at DESC
      `,
      params
    );

    return result.rows.map(
      (row: SavedFilterRow): SavedFilter => ({
        id: row.id,
        agencyId: row.agency_id,
        ownerId: row.owner_id,
        scope: row.scope,
        payload: row.payload
      })
    );
  };

  const loadExplorationMentions = async (
    session: SessionContext,
    filters: ExplorationFilters = {}
  ) =>
    filterExplorationMentions(
      await listMentionsEnriched(
        session,
        {
          agencyId: filters.agencyId,
          source: filters.source,
          sentiment: filters.sentiment,
          priority: filters.priority,
          q: filters.q,
          from: filters.from,
          to: filters.to
        },
        {
          includeDisabled: false
        }
      ),
      filters
    );

  const getExplorationMeta: Repository["getExplorationMeta"] = async (
    session,
    filters = {}
  ) => {
    await ensureReady();
    const pool = getPool();
    const [agencies, mentions] = await Promise.all([
      listAgencies(session),
      listMentionsEnriched(
        session,
        {
          agencyId: filters.agencyId
        },
        {
          includeDisabled: false
        }
      )
    ]);
    const params: unknown[] = [];
    const batchClauses: string[] = [];
    const scopedAgencyIds = visibleAgencyIds(session);

    if (scopedAgencyIds) {
      params.push(scopedAgencyIds);
      batchClauses.push(`ib.agency_id = ANY($${params.length}::text[])`);
    }

    if (filters.agencyId) {
      params.push(filters.agencyId);
      batchClauses.push(`ib.agency_id = $${params.length}`);
    }

    const batchResult = await pool.query<
      QueryResultRow & {
        id: string;
        created_at: Date | string;
        range_from: Date | string | null;
        range_to: Date | string | null;
        query_id: string | null;
        query_label: string | null;
        mention_count: string | number;
      }
    >(
      `
        SELECT
          ib.id,
          ib.created_at,
          MIN(m.occurred_at) AS range_from,
          MAX(m.occurred_at) AS range_to,
          COALESCE(sq.external_id, ib.source_query_id) AS query_id,
          sq.name AS query_label,
          COUNT(m.id) AS mention_count
        FROM import_batches ib
        LEFT JOIN mentions m ON m.import_batch_id = ib.id
        LEFT JOIN source_queries sq ON sq.id = ib.source_query_id
        ${batchClauses.length ? `WHERE ${batchClauses.join(" AND ")}` : ""}
        GROUP BY ib.id, ib.created_at, sq.external_id, ib.source_query_id, sq.name
        ORDER BY ib.created_at DESC
      `,
      params
    );

    const queryResult = await pool.query<
      QueryResultRow & {
        id: string;
        label: string | null;
        mention_count: string | number;
      }
    >(
      `
        SELECT
          COALESCE(sq.external_id, m.source_query_id) AS id,
          sq.name AS label,
          COUNT(m.id) AS mention_count
        FROM mentions m
        LEFT JOIN source_queries sq ON sq.id = m.source_query_id
        ${
          batchClauses.length
            ? `WHERE ${batchClauses
                .map((clause) => clause.replaceAll("ib.", "m."))
                .join(" AND ")}`
            : ""
        }
        GROUP BY COALESCE(sq.external_id, m.source_query_id), sq.name
        ORDER BY mention_count DESC, label ASC
      `,
      params
    );

    return buildExplorationMeta(
      {
        mentions,
        agencies,
        batchDetails: batchResult.rows.map((row) => ({
          id: row.id,
          label: row.query_label ?? `Batch ${row.id.slice(0, 8)}`,
          createdAt: toIsoString(row.created_at),
          from: row.range_from ? toIsoString(row.range_from) : undefined,
          to: row.range_to ? toIsoString(row.range_to) : undefined,
          queryId: row.query_id ?? undefined,
          queryLabel: row.query_label ?? undefined
        })),
        queryDetails: queryResult.rows.map((row) => ({
          id: row.id,
          label: row.label ?? row.id
        }))
      },
      filters
    );
  };

  const getExplorationSummary: Repository["getExplorationSummary"] = async (
    session,
    filters = {}
  ) =>
    buildExplorationSummary(
      await loadExplorationMentions(session, filters),
      filters
    );

  const getExplorationTimeseries: Repository["getExplorationTimeseries"] =
    async (session, filters = {}, granularity) => {
      const mentions = await loadExplorationMentions(session, filters);
      return buildExplorationTimeseries(
        mentions,
        granularity ?? resolveExplorationGranularity(mentions, filters)
      );
    };

  const getExplorationHeatmap: Repository["getExplorationHeatmap"] = async (
    session,
    filters = {}
  ) => buildExplorationHeatmap(await loadExplorationMentions(session, filters));

  const getExplorationBreakdowns: Repository["getExplorationBreakdowns"] =
    async (session, filters = {}) =>
      buildExplorationBreakdowns(
        await loadExplorationMentions(session, filters)
      );

  const getExplorationScatter: Repository["getExplorationScatter"] = async (
    session,
    filters = {}
  ) => buildExplorationScatter(await loadExplorationMentions(session, filters));

  const getExplorationEntities: Repository["getExplorationEntities"] = async (
    session,
    filters = {}
  ) =>
    buildExplorationEntities(await loadExplorationMentions(session, filters));

  const listExplorationMentions: Repository["listExplorationMentions"] = async (
    session,
    filters = {},
    options: ExplorationMentionListOptions = {}
  ) =>
    buildExplorationMentionRows(
      await loadExplorationMentions(session, filters),
      options
    );

  const getDashboardSummary: Repository["getDashboardSummary"] = async (
    session
  ) => {
    await ensureReady();
    const pool = getPool();
    const scopedAgencyIds = visibleAgencyIds(session);
    const params = scopedAgencyIds ? [scopedAgencyIds] : [];
    const agencyClause = scopedAgencyIds
      ? `WHERE agency_id = ANY($1::text[])`
      : "";
    const countResult = await pool.query<DashboardSummaryRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM mentions ${agencyClause}) AS mentions_last_24h,
          (SELECT COUNT(*) FROM alerts ${agencyClause ? agencyClause : ""} ${agencyClause ? "AND" : "WHERE"} status = 'open') AS open_alerts,
          (SELECT COUNT(*) FROM cases ${agencyClause ? agencyClause : ""} ${agencyClause ? "AND" : "WHERE"} status <> 'closed') AS open_cases,
          (SELECT COUNT(*) FROM mentions ${agencyClause ? agencyClause : ""} ${agencyClause ? "AND" : "WHERE"} is_critical = TRUE) AS critical_mentions,
          (SELECT COUNT(*) FROM agencies ${scopedAgencyIds ? "WHERE id = ANY($1::text[])" : ""}) AS agencies_covered
      `,
      params
    );
    const row = countResult.rows[0] ?? {
      mentions_last_24h: 0,
      open_alerts: 0,
      open_cases: 0,
      critical_mentions: 0,
      agencies_covered: 0
    };
    return {
      mentionsLast24h: Number(row.mentions_last_24h ?? 0),
      openAlerts: Number(row.open_alerts ?? 0),
      openCases: Number(row.open_cases ?? 0),
      criticalMentions: Number(row.critical_mentions ?? 0),
      agenciesCovered: Number(row.agencies_covered ?? 0)
    };
  };

  const createCase: Repository["createCase"] = async (session, input) => {
    await ensureReady();
    if (!canManageCases(session, input.agencyId)) {
      throw new Error(
        `Role ${session.role} cannot create cases for ${input.agencyId}`
      );
    }

    if (input.mentionId) {
      const mentions = await listMentions(session, {
        agencyId: input.agencyId
      });
      if (!mentions.some((mention) => mention.id === input.mentionId)) {
        throw new Error(`Mention ${input.mentionId} not found`);
      }
    }

    const pool = getPool();
    const record: Case = {
      id: createId("case"),
      agencyId: input.agencyId,
      mentionId: input.mentionId,
      alertId: input.alertId,
      title: input.title,
      summary: input.summary,
      status: "new",
      priority: input.priority,
      assignedToId: input.assignedToId,
      createdById: session.userId,
      createdAt: now(),
      updatedAt: now()
    };

    await pool.query(
      `
        INSERT INTO cases (id, agency_id, mention_id, alert_id, title, summary, status, priority, assigned_to_id, created_by_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        record.id,
        record.agencyId,
        record.mentionId ?? null,
        record.alertId ?? null,
        record.title,
        record.summary,
        record.status,
        record.priority,
        record.assignedToId ?? null,
        record.createdById,
        record.createdAt,
        record.updatedAt
      ]
    );

    await pool.query(
      `
        INSERT INTO case_events (id, case_id, actor_id, type, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        createId("case-event"),
        record.id,
        session.userId,
        "created",
        "Caso creado desde consola operativa.",
        now()
      ]
    );

    await pool.query(
      `
        INSERT INTO audit_logs (id, actor_id, agency_id, action, subject_type, subject_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        createId("audit"),
        session.userId,
        input.agencyId,
        "case.created",
        "case",
        record.id,
        JSON.stringify({ priority: input.priority }),
        now()
      ]
    );

    return record;
  };

  const updateCase: Repository["updateCase"] = async (
    session,
    caseId,
    input
  ) => {
    await ensureReady();
    const pool = getPool();
    const found = await pool.query<CaseRow>(
      `SELECT * FROM cases WHERE id = $1 LIMIT 1`,
      [caseId]
    );
    const row = found.rows[0];

    if (!row) {
      throw new Error(`Case ${caseId} not found`);
    }

    if (!canManageCases(session, row.agency_id)) {
      throw new Error(
        `Role ${session.role} cannot update cases for ${row.agency_id}`
      );
    }

    if (input.status) {
      assertCaseTransition(row.status, input.status);
      row.status = input.status;
      await pool.query(
        `INSERT INTO case_events (id, case_id, actor_id, type, description, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId("case-event"),
          caseId,
          session.userId,
          "status_changed",
          `Estado actualizado a ${input.status}.`,
          now()
        ]
      );
    }

    if (input.priority) {
      row.priority = input.priority;
      await pool.query(
        `INSERT INTO case_events (id, case_id, actor_id, type, description, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId("case-event"),
          caseId,
          session.userId,
          "priority_changed",
          `Prioridad actualizada a ${input.priority}.`,
          now()
        ]
      );
    }

    if (input.assignedToId) {
      row.assigned_to_id = input.assignedToId;
      await pool.query(
        `INSERT INTO case_events (id, case_id, actor_id, type, description, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId("case-event"),
          caseId,
          session.userId,
          "assigned",
          `Caso asignado a ${input.assignedToId}.`,
          now()
        ]
      );
    }

    if (input.note) {
      await pool.query(
        `INSERT INTO case_events (id, case_id, actor_id, type, description, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId("case-event"),
          caseId,
          session.userId,
          "comment",
          input.note,
          now()
        ]
      );
    }

    const updatedAt = now();
    await pool.query(
      `
        UPDATE cases
        SET status = $2, priority = $3, assigned_to_id = $4, updated_at = $5
        WHERE id = $1
      `,
      [caseId, row.status, row.priority, row.assigned_to_id ?? null, updatedAt]
    );

    await pool.query(
      `
        INSERT INTO audit_logs (id, actor_id, agency_id, action, subject_type, subject_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        createId("audit"),
        session.userId,
        row.agency_id,
        "case.updated",
        "case",
        caseId,
        JSON.stringify({ status: row.status, priority: row.priority }),
        now()
      ]
    );

    return {
      id: row.id,
      agencyId: row.agency_id,
      mentionId: row.mention_id ?? undefined,
      alertId: row.alert_id ?? undefined,
      title: row.title,
      summary: row.summary,
      status: row.status,
      priority: row.priority,
      assignedToId: row.assigned_to_id ?? undefined,
      createdById: row.created_by_id,
      createdAt: toIsoString(row.created_at),
      updatedAt
    };
  };

  const acknowledgeAlert: Repository["acknowledgeAlert"] = async (
    session,
    alertId
  ) => {
    await ensureReady();
    const pool = getPool();
    const found = await pool.query<AlertRow>(
      `SELECT * FROM alerts WHERE id = $1 LIMIT 1`,
      [alertId]
    );
    const row = found.rows[0];
    if (!row) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!canAcknowledgeAlerts(session, row.agency_id)) {
      throw new Error(
        `Role ${session.role} cannot acknowledge alerts for ${row.agency_id}`
      );
    }

    const updatedAt = now();
    await pool.query(
      `UPDATE alerts SET status = 'acknowledged', updated_at = $2 WHERE id = $1`,
      [alertId, updatedAt]
    );
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, agency_id, action, subject_type, subject_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        createId("audit"),
        session.userId,
        row.agency_id,
        "alert.acknowledged",
        "alert",
        alertId,
        JSON.stringify({ status: "acknowledged" }),
        now()
      ]
    );

    return {
      id: row.id,
      agencyId: row.agency_id,
      mentionId: row.mention_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: "acknowledged",
      createdAt: toIsoString(row.created_at),
      updatedAt
    };
  };

  const upsertMentions: Repository["upsertMentions"] = async (
    mentions,
    run
  ) => {
    await ensureReady();
    const pool = getPool();
    let insertedCount = 0;
    let duplicateCount = 0;
    const createdAlerts: Alert[] = [];

    for (const mention of mentions) {
      const sourceSystem = mention.sourceSystem ?? "brandwatch_api";
      const existing = await pool.query(
        `
          SELECT id
          FROM mentions
          WHERE agency_id = $1 AND external_id = $2 AND source_system = $3
          LIMIT 1
        `,
        [mention.agencyId, mention.externalId, sourceSystem]
      );

      if (existing.rows[0]) {
        duplicateCount += 1;
        continue;
      }

      insertedCount += 1;
      await pool.query(
        `
          INSERT INTO mentions (id, agency_id, external_id, source, source_system, channel, title, body, url, language, sentiment, priority, author_name, author_handle, topics, keywords, is_critical, occurred_at, received_at, raw_object_key, engagement)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text[], $16::text[], $17, $18, $19, $20, $21::jsonb)
        `,
        [
          mention.id,
          mention.agencyId,
          mention.externalId,
          mention.source,
          sourceSystem,
          mention.channel,
          mention.title ?? null,
          mention.body,
          mention.url,
          mention.language,
          mention.sentiment,
          mention.priority,
          mention.authorName,
          mention.authorHandle ?? null,
          mention.topics,
          mention.keywords,
          mention.isCritical,
          mention.occurredAt,
          mention.receivedAt,
          mention.rawObjectKey ?? null,
          JSON.stringify(mention.engagement)
        ]
      );

      if (
        mention.isCritical ||
        mention.sentiment === "negative" ||
        mention.keywords.some((keyword) =>
          ["crisis", "interrupción", "emergencia"].includes(
            keyword.toLowerCase()
          )
        )
      ) {
        const alert = createAlertFromMention(mention);
        createdAlerts.push(alert);
        await pool.query(
          `INSERT INTO alerts (id, agency_id, mention_id, title, description, severity, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            alert.id,
            alert.agencyId,
            alert.mentionId,
            alert.title,
            alert.description,
            alert.severity,
            alert.status,
            alert.createdAt,
            alert.updatedAt
          ]
        );
      }
    }

    await pool.query(
      `INSERT INTO brandwatch_sync_runs (id, agency_id, source_window, fetched_count, inserted_count, duplicate_count, status, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        createId("sync"),
        run.agencyId,
        run.sourceWindow,
        run.fetchedCount,
        insertedCount,
        duplicateCount,
        duplicateCount > 0 ? "partial" : "completed",
        run.startedAt,
        run.finishedAt
      ]
    );

    const artifactsClient = await pool.connect();
    try {
      await ensureEnrichmentArtifacts(artifactsClient);
    } finally {
      artifactsClient.release();
    }

    return {
      insertedCount,
      duplicateCount,
      createdAlerts
    };
  };

  const importBrandwatchWorkbook = async (
    input: BrandwatchWorkbookImportInput
  ): Promise<ImportResult> => {
    await ensureReady();
    const pool = getPool();
    const existingBatch = await pool.query<{ id: string; rows_read: number }>(
      `SELECT id, rows_read FROM import_batches WHERE checksum = $1 LIMIT 1`,
      [input.checksum]
    );

    if (existingBatch.rows[0]) {
      return {
        batchId: existingBatch.rows[0].id,
        rowsRead: existingBatch.rows[0].rows_read,
        rowsInserted: 0,
        rowsDeduped: input.items.length,
        mentionsUpserted: 0,
        metricsInserted: 0,
        errors: [],
        createdAlerts: []
      };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const sourceQueryId = `source-query-${randomUUID()}`;
      const sourceQueryResult = await client.query<{ id: string }>(
        `
          INSERT INTO source_queries (id, external_id, name, brand_name, report_name, label, source_from, source_to, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
          ON CONFLICT (external_id, name) DO UPDATE
          SET brand_name = EXCLUDED.brand_name,
              report_name = EXCLUDED.report_name,
              label = EXCLUDED.label,
              source_from = EXCLUDED.source_from,
              source_to = EXCLUDED.source_to,
              updated_at = NOW()
          RETURNING id
        `,
        [
          sourceQueryId,
          input.items[0]?.sourceQueryExternalId ?? "unknown",
          input.items[0]?.sourceQueryName ?? input.metadata.brandName,
          input.metadata.brandName,
          input.metadata.reportName,
          input.metadata.label || null,
          input.metadata.from,
          input.metadata.to
        ]
      );
      const actualSourceQueryId = sourceQueryResult.rows[0].id;

      const batchId = `batch-${randomUUID()}`;
      await client.query(
        `
          INSERT INTO import_batches (id, agency_id, source_query_id, file_name, sheet_name, checksum, s3_key, raw_object_key, rows_read, status, error_summary, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','[]'::jsonb,NOW(),NOW())
        `,
        [
          batchId,
          input.agencyId,
          actualSourceQueryId,
          input.fileName,
          input.sheetName,
          input.checksum,
          input.s3Key,
          input.rawObjectKey,
          input.items.length
        ]
      );

      let rowsDeduped = 0;
      let mentionsUpserted = 0;
      let metricsInserted = 0;
      const createdAlerts: Alert[] = [];

      for (const item of input.items) {
        const authorId = await resolveAuthorId(client, item);
        const publicationId = await resolvePublicationId(client, item);
        const threadId = await resolveThreadId(client, item);
        const geographyId = await resolveGeographyId(client, item);
        const sourceSystem = item.mention.sourceSystem ?? "brandwatch_export";

        const existingMention = await client.query<{ id: string }>(
          `SELECT id FROM mentions WHERE agency_id = $1 AND external_id = $2 AND source_system = $3 LIMIT 1`,
          [item.mention.agencyId, item.mention.externalId, sourceSystem]
        );

        const mentionId = existingMention.rows[0]?.id ?? item.mention.id;

        if (existingMention.rows[0]) {
          rowsDeduped += 1;
          await client.query(
            `
              UPDATE mentions
              SET source_query_id = $2,
                  import_batch_id = $3,
                  author_id = $4,
                  publication_id = $5,
                  thread_id = $6,
                  geography_id = $7,
                  source = $8,
                  source_system = $9,
                  channel = $10,
                  title = $11,
                  body = $12,
                  url = $13,
                  language = $14,
                  sentiment = $15,
                  priority = $16,
                  author_name = $17,
                  author_handle = $18,
                  topics = $19::text[],
                  keywords = $20::text[],
                  is_critical = $21,
                  occurred_at = $22,
                  received_at = $23,
                  raw_object_key = $24,
                  engagement = $25::jsonb,
                  updated_at = NOW()
              WHERE id = $1
            `,
            [
              mentionId,
              actualSourceQueryId,
              batchId,
              authorId ?? null,
              publicationId ?? null,
              threadId ?? null,
              geographyId ?? null,
              item.mention.source,
              sourceSystem,
              item.mention.channel,
              item.mention.title ?? null,
              item.mention.body,
              item.mention.url,
              item.mention.language,
              item.mention.sentiment,
              item.mention.priority,
              item.mention.authorName,
              item.mention.authorHandle ?? null,
              item.mention.topics,
              item.mention.keywords,
              item.mention.isCritical,
              item.mention.occurredAt,
              item.mention.receivedAt,
              item.mention.rawObjectKey ?? null,
              JSON.stringify(item.mention.engagement)
            ]
          );
          await client.query(
            `DELETE FROM mention_metrics WHERE mention_id = $1`,
            [mentionId]
          );
          await client.query(
            `DELETE FROM mention_attributes WHERE mention_id = $1`,
            [mentionId]
          );
        } else {
          mentionsUpserted += 1;
          await client.query(
            `
              INSERT INTO mentions (id, agency_id, source_query_id, import_batch_id, author_id, publication_id, thread_id, geography_id, external_id, source, source_system, channel, title, body, url, language, sentiment, priority, author_name, author_handle, topics, keywords, is_critical, occurred_at, received_at, raw_object_key, engagement, created_at, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::text[],$22::text[],$23,$24,$25,$26,$27::jsonb,NOW(),NOW())
            `,
            [
              mentionId,
              item.mention.agencyId,
              actualSourceQueryId,
              batchId,
              authorId ?? null,
              publicationId ?? null,
              threadId ?? null,
              geographyId ?? null,
              item.mention.externalId,
              item.mention.source,
              sourceSystem,
              item.mention.channel,
              item.mention.title ?? null,
              item.mention.body,
              item.mention.url,
              item.mention.language,
              item.mention.sentiment,
              item.mention.priority,
              item.mention.authorName,
              item.mention.authorHandle ?? null,
              item.mention.topics,
              item.mention.keywords,
              item.mention.isCritical,
              item.mention.occurredAt,
              item.mention.receivedAt,
              item.mention.rawObjectKey ?? null,
              JSON.stringify(item.mention.engagement)
            ]
          );
        }

        await client.query(
          `
            INSERT INTO mention_raw_rows (id, import_batch_id, mention_id, row_number, query_id, source_mention_id, resource_id, canonical_external_id, url, page_type, content_source_name, raw_payload, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,NOW())
          `,
          [
            `raw-row-${randomUUID()}`,
            batchId,
            mentionId,
            item.rawRow.rowNumber,
            item.rawRow.queryId,
            item.rawRow.mentionId ?? null,
            item.rawRow.resourceId ?? null,
            item.rawRow.canonicalExternalId,
            item.rawRow.url,
            item.rawRow.pageType ?? null,
            item.rawRow.contentSourceName ?? null,
            JSON.stringify(item.rawRow.rawPayload)
          ]
        );

        for (const metric of item.metrics) {
          await client.query(
            `
              INSERT INTO mention_metrics (id, mention_id, metric_name, metric_value, platform, source_column, unit, created_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
            `,
            [
              createId("metric"),
              mentionId,
              metric.metricName,
              metric.metricValue,
              metric.platform,
              metric.sourceColumn,
              metric.unit ?? null
            ]
          );
          metricsInserted += 1;
        }

        for (const attribute of item.attributes) {
          await client.query(
            `
              INSERT INTO mention_attributes (id, mention_id, attribute_name, attribute_value, value_type, platform, source_column, created_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
            `,
            [
              createId("attribute"),
              mentionId,
              attribute.attributeName,
              attribute.attributeValue,
              attribute.valueType,
              attribute.platform,
              attribute.sourceColumn
            ]
          );
        }

        if (
          item.mention.isCritical ||
          item.mention.sentiment === "negative" ||
          item.mention.keywords.some((keyword) =>
            ["crisis", "interrupción", "emergencia"].includes(
              keyword.toLowerCase()
            )
          )
        ) {
          const existingAlert = await client.query(
            `SELECT id FROM alerts WHERE mention_id = $1 AND status = 'open' LIMIT 1`,
            [mentionId]
          );
          if (!existingAlert.rows[0]) {
            const alert = createAlertFromMention({
              ...item.mention,
              id: mentionId
            });
            createdAlerts.push(alert);
            await client.query(
              `INSERT INTO alerts (id, agency_id, mention_id, title, description, severity, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                alert.id,
                alert.agencyId,
                mentionId,
                alert.title,
                alert.description,
                alert.severity,
                alert.status,
                alert.createdAt,
                alert.updatedAt
              ]
            );
          }
        }
      }

      await client.query(
        `
          UPDATE import_batches
          SET rows_inserted = $2,
              rows_deduped = $3,
              mentions_upserted = $4,
              metrics_inserted = $5,
              status = 'completed',
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          batchId,
          input.items.length,
          rowsDeduped,
          mentionsUpserted,
          metricsInserted
        ]
      );

      await ensureEnrichmentArtifacts(client);

      await client.query("COMMIT");

      return {
        batchId,
        rowsRead: input.items.length,
        rowsInserted: input.items.length,
        rowsDeduped,
        mentionsUpserted,
        metricsInserted,
        errors: [],
        createdAlerts
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    ready: ensureReady,
    getDashboardSummary,
    getExplorationMeta,
    getExplorationSummary,
    getExplorationTimeseries,
    getExplorationHeatmap,
    getExplorationBreakdowns,
    getExplorationScatter,
    getExplorationEntities,
    listExplorationMentions,
    listEnrichmentDefinitions,
    listMentions,
    listMentionsEnriched,
    getMentionEnrichments,
    listEnrichmentRollups,
    listAlerts,
    listCases,
    listAgencies,
    listUsers,
    listSavedFilters,
    createCase,
    updateCase,
    acknowledgeAlert,
    upsertMentions,
    importBrandwatchWorkbook
  };
};
