export type Agency = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "analista" | "lector";
  agencyIds: string[];
};

export type MentionSource = "social" | "news" | "web";
export type MentionSentiment = "positive" | "neutral" | "negative" | "mixed";
export type CaseStatus = "new" | "triaged" | "in_progress" | "closed";
export type CasePriority = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AlertSeverity = "critical" | "high" | "medium";
export type DeliveryChannel = "in_app" | "email";
export type SourceSystem = "brandwatch_api" | "brandwatch_export";

export type NormalizedMention = {
  id: string;
  agencyId: string;
  externalId: string;
  source: MentionSource;
  sourceSystem?: SourceSystem;
  channel: string;
  title?: string;
  body: string;
  url: string;
  language: string;
  sentiment: MentionSentiment;
  priority: CasePriority;
  authorName: string;
  authorHandle?: string;
  topics: string[];
  keywords: string[];
  occurredAt: string;
  receivedAt: string;
  isCritical: boolean;
  rawObjectKey?: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };
};

export type Alert = {
  id: string;
  agencyId: string;
  mentionId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
};

export type AlertRule = {
  id: string;
  agencyId: string;
  type: "spike" | "critical_mention" | "keyword" | "negative_sentiment";
  title: string;
  threshold?: number;
  keywords?: string[];
  isActive: boolean;
};

export type AlertDelivery = {
  id: string;
  alertId: string;
  channel: DeliveryChannel;
  recipient: string;
  status: "pending" | "sent";
  deliveredAt?: string;
};

export type Case = {
  id: string;
  agencyId: string;
  mentionId?: string;
  alertId?: string;
  title: string;
  summary: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedToId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  actorId: string;
  type:
    | "created"
    | "assigned"
    | "priority_changed"
    | "status_changed"
    | "comment";
  description: string;
  createdAt: string;
};

export type SavedFilter = {
  id: string;
  agencyId: string;
  ownerId: string;
  scope: "mentions" | "alerts" | "cases";
  payload: Record<string, string>;
};

export type AuditLog = {
  id: string;
  actorId: string;
  agencyId: string;
  action: string;
  subjectType: "mention" | "alert" | "case";
  subjectId: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type BrandwatchSyncRun = {
  id: string;
  agencyId: string;
  sourceWindow: string;
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  status: "completed" | "partial";
  startedAt: string;
  finishedAt: string;
};

export type MentionFilters = Partial<{
  agencyId: string;
  source: MentionSource;
  sentiment: MentionSentiment;
  priority: CasePriority;
  q: string;
  from: string;
  to: string;
}>;

export type ExplorationFilters = MentionFilters &
  Partial<{
    batchId: string;
    sourceQueryId: string;
    sourceClass: string;
    platformFamily: string;
    language: string;
    country: string;
  }>;

export type EnrichmentWindow = "24h" | "7d" | "batch";
export type EnrichmentGroupBy =
  | "platform_family"
  | "source_class"
  | "sentiment"
  | "language"
  | "country"
  | "import_batch_id"
  | "source_query_id";
export type EnrichmentCategory =
  | "identity_trace"
  | "time_freshness"
  | "geo"
  | "content"
  | "sentiment_risk"
  | "engagement"
  | "platform"
  | "authority"
  | "conversation"
  | "semantic";
export type EnrichmentGrain =
  | "mention"
  | "thread"
  | "author_day"
  | "domain_day"
  | "query_platform_hour"
  | "rollup";
export type EnrichmentValueType =
  | "string"
  | "number"
  | "boolean"
  | "bucket"
  | "key"
  | "json";
export type EnrichmentSourceCoverage =
  | "all_sources"
  | "brandwatch_export_preferred"
  | "brandwatch_export_only"
  | "thread_context_optional"
  | "aggregate";
export type EnrichmentNullPolicy =
  | "null_if_missing"
  | "fallback_to_canonical"
  | "fallback_to_zero"
  | "derived_from_available_inputs";
export type EnrichmentValue =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>;

export type EnrichmentDefinition = {
  code: string;
  slug: string;
  label: string;
  category: EnrichmentCategory;
  grain: EnrichmentGrain;
  valueType: EnrichmentValueType;
  isEnabled: boolean;
  dependsOn: string[];
  sourceCoverage: EnrichmentSourceCoverage;
  nullPolicy: EnrichmentNullPolicy;
  description: string;
};

export type EnrichmentMeta = {
  batchId?: string;
  queryId?: string;
  windowKeys: Partial<Record<EnrichmentWindow, string>>;
};

export type EnrichedMention = NormalizedMention & {
  enrichments: Record<string, EnrichmentValue>;
  enrichmentMeta?: EnrichmentMeta;
};

export type EnrichmentListOptions = Partial<{
  includeDisabled: boolean;
  limit: number;
  offset: number;
}>;

export type EnrichmentRollup = {
  agencyId: string;
  batchId?: string;
  groupBy: EnrichmentGroupBy;
  groupKey: string;
  queryId?: string;
  values: Record<string, EnrichmentValue>;
  window: EnrichmentWindow;
};

export type EnrichmentRollupFilters = {
  agencyId?: string;
  batchId?: string;
  groupBy: EnrichmentGroupBy;
  includeDisabled?: boolean;
  window: EnrichmentWindow;
};

export type DashboardSummary = {
  mentionsLast24h: number;
  openAlerts: number;
  openCases: number;
  criticalMentions: number;
  agenciesCovered: number;
};

export type ExplorationTimeseriesGranularity = "hour" | "day";

export type ExplorationMetaOption = {
  value: string;
  label: string;
  count: number;
};

export type ExplorationBatchOption = {
  id: string;
  label: string;
  createdAt?: string;
  from?: string;
  to?: string;
  queryId?: string;
  queryLabel?: string;
  count: number;
};

export type ExplorationQueryOption = {
  id: string;
  label: string;
  count: number;
};

export type ExplorationMeta = {
  defaults: {
    agencyId: string;
    batchId?: string;
    from?: string;
    to?: string;
  };
  lastIngestedAt?: string;
  agencies: Agency[];
  batches: ExplorationBatchOption[];
  queries: ExplorationQueryOption[];
  sourceClasses: ExplorationMetaOption[];
  platformFamilies: ExplorationMetaOption[];
  languages: ExplorationMetaOption[];
  countries: ExplorationMetaOption[];
  sentiments: ExplorationMetaOption[];
  priorities: ExplorationMetaOption[];
};

export type ExplorationSummary = {
  totalMentions: number;
  negativeMentions: number;
  criticalMentions: number;
  avgRiskBaseScore: number;
  avgEarnedAttentionIndex: number;
  avgCaptureLatencyMinutes: number;
  selectedRange: {
    from?: string;
    to?: string;
  };
  batchId?: string;
  queryId?: string;
  lastIngestedAt?: string;
};

export type ExplorationTimeseriesPoint = {
  bucket: string;
  label: string;
  totalCount: number;
  negativeCount: number;
  criticalCount: number;
  platformCounts: Record<string, number>;
};

export type ExplorationHeatmapCell = {
  weekday: string;
  daypart: string;
  count: number;
};

export type ExplorationBreakdownItem = {
  key: string;
  label: string;
  count: number;
  share: number;
};

export type ExplorationSentimentByPlatform = {
  platformFamily: string;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  total: number;
};

export type ExplorationBoxplotStat = {
  key: string;
  label: string;
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
};

export type ExplorationHistogramBin = {
  x0: number;
  x1: number;
  count: number;
};

export type ExplorationBreakdowns = {
  platformFamily: ExplorationBreakdownItem[];
  country: ExplorationBreakdownItem[];
  language: ExplorationBreakdownItem[];
  sentimentByPlatform: ExplorationSentimentByPlatform[];
  interactionBoxplotByPlatform: ExplorationBoxplotStat[];
  latencyHistogram: ExplorationHistogramBin[];
};

export type ExplorationScatterPoint = {
  id: string;
  title: string;
  platformFamily: string;
  sentiment: MentionSentiment;
  riskBaseScore: number;
  earnedAttentionIndex: number;
  totalInteractionsBase: number;
  isCritical: boolean;
};

export type ExplorationEntityNode = {
  key: string;
  label: string;
  value: number;
};

export type ExplorationMentionRow = {
  id: string;
  title: string;
  bodyPreview: string;
  url: string;
  platformFamily: string;
  sourceClass: string;
  sentiment: MentionSentiment;
  priority: CasePriority;
  authorName: string;
  occurredAt: string;
  country: string;
  earnedAttentionIndex: number;
  riskBaseScore: number;
  totalInteractionsBase: number;
  isCritical: boolean;
};

export type ExplorationEntities = {
  topPublicationsOrDomains: ExplorationEntityNode[];
  mentionTable: ExplorationMentionRow[];
};

export type ExplorationMentionListOptions = Partial<{
  limit: number;
  offset: number;
  sort: "earned_attention_desc" | "occurred_desc";
}>;

export type CreateCaseInput = {
  agencyId: string;
  mentionId?: string;
  alertId?: string;
  title: string;
  summary: string;
  priority: CasePriority;
  assignedToId?: string;
};

export type UpdateCaseInput = Partial<{
  status: CaseStatus;
  priority: CasePriority;
  assignedToId: string;
  note: string;
}>;

export type RepositorySeed = {
  agencies: Agency[];
  users: User[];
  mentions: NormalizedMention[];
  alerts: Alert[];
  deliveries: AlertDelivery[];
  cases: Case[];
  caseEvents: CaseEvent[];
  savedFilters: SavedFilter[];
  auditLogs: AuditLog[];
  rules: AlertRule[];
  syncRuns: BrandwatchSyncRun[];
};

export type BrandwatchExportMetadata = {
  reportName: string;
  brandName: string;
  from: string;
  to: string;
  label: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
};

export type SourceQueryRecord = {
  id: string;
  externalId: string;
  name: string;
  brandName: string;
  reportName: string;
  from: string;
  to: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
};

export type ImportBatchStatus =
  | "pending"
  | "completed"
  | "failed"
  | "duplicate";

export type ImportBatch = {
  id: string;
  agencyId: string;
  sourceQueryId: string;
  fileName: string;
  sheetName: string;
  checksum: string;
  s3Key: string;
  rawObjectKey: string;
  rowsRead: number;
  rowsInserted: number;
  rowsDeduped: number;
  mentionsUpserted: number;
  metricsInserted: number;
  status: ImportBatchStatus;
  errorSummary: string[];
  createdAt: string;
  updatedAt: string;
};

export type StagedMentionRaw = {
  id: string;
  importBatchId: string;
  rowNumber: number;
  queryId: string;
  mentionId?: string;
  resourceId?: string;
  canonicalExternalId: string;
  url: string;
  pageType?: string;
  contentSourceName?: string;
  rawPayload: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type AuthorProfile = {
  id: string;
  platform: string;
  sourceAuthorId?: string;
  name?: string;
  handle?: string;
  fullName?: string;
  accountType?: string;
  verifiedType?: string;
  avatarUrl?: string;
  followers?: number;
  following?: number;
  posts?: number;
  rawProfile?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
};

export type Publication = {
  id: string;
  platform: string;
  sourcePublicationId?: string;
  name?: string;
  domain?: string;
  pageType?: string;
  pubType?: string;
  publisherSubtype?: string;
  blogName?: string;
  subreddit?: string;
  subscribers?: number;
  dailyVisitors?: number;
  totalMonthlyVisitors?: number;
  createdAt: string;
  updatedAt: string;
};

export type MentionThread = {
  id: string;
  platform: string;
  sourceThreadId?: string;
  parentPostId?: string;
  rootPostId?: string;
  threadUrl?: string;
  threadAuthor?: string;
  threadCreatedAt?: string;
  entryType?: string;
  parentBlogName?: string;
  rootBlogName?: string;
  createdAt: string;
  updatedAt: string;
};

export type Geography = {
  id: string;
  continentCode?: string;
  continent?: string;
  countryCode?: string;
  country?: string;
  regionCode?: string;
  region?: string;
  cityCode?: string;
  city?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
};

export type MentionMetric = {
  id: string;
  mentionId: string;
  metricName: string;
  metricValue: number;
  platform: string;
  sourceColumn: string;
  unit?: string;
  createdAt: string;
};

export type MentionAttribute = {
  id: string;
  mentionId: string;
  attributeName: string;
  attributeValue: string;
  valueType: "string" | "boolean" | "date" | "url" | "list" | "json";
  platform: string;
  sourceColumn: string;
  createdAt: string;
};

export type CanonicalMentionImport = {
  sourceQueryExternalId: string;
  sourceQueryName: string;
  metadata: BrandwatchExportMetadata;
  mention: NormalizedMention;
  rawRow: Omit<StagedMentionRaw, "id" | "importBatchId" | "createdAt">;
  author?: Omit<AuthorProfile, "id" | "createdAt" | "updatedAt">;
  publication?: Omit<Publication, "id" | "createdAt" | "updatedAt">;
  thread?: Omit<MentionThread, "id" | "createdAt" | "updatedAt">;
  geography?: Omit<Geography, "id" | "createdAt" | "updatedAt">;
  metrics: Array<Omit<MentionMetric, "id" | "mentionId" | "createdAt">>;
  attributes: Array<Omit<MentionAttribute, "id" | "mentionId" | "createdAt">>;
};

export type BrandwatchWorkbookImportInput = {
  agencyId: string;
  fileName: string;
  sheetName: string;
  s3Key: string;
  rawObjectKey: string;
  checksum: string;
  metadata: BrandwatchExportMetadata;
  items: CanonicalMentionImport[];
};

export type ImportResult = {
  batchId: string;
  rowsRead: number;
  rowsInserted: number;
  rowsDeduped: number;
  mentionsUpserted: number;
  metricsInserted: number;
  errors: string[];
  createdAlerts: Alert[];
};

export type Repository = {
  state?: RepositorySeed;
  ready(): Promise<void>;
  getDashboardSummary(
    session: import("@sac/auth").SessionContext
  ): DashboardSummary | Promise<DashboardSummary>;
  getExplorationMeta(
    session: import("@sac/auth").SessionContext,
    filters?: Pick<ExplorationFilters, "agencyId">
  ): ExplorationMeta | Promise<ExplorationMeta>;
  getExplorationSummary(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters
  ): ExplorationSummary | Promise<ExplorationSummary>;
  getExplorationTimeseries(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters,
    granularity?: ExplorationTimeseriesGranularity
  ): ExplorationTimeseriesPoint[] | Promise<ExplorationTimeseriesPoint[]>;
  getExplorationHeatmap(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters
  ): ExplorationHeatmapCell[] | Promise<ExplorationHeatmapCell[]>;
  getExplorationBreakdowns(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters
  ): ExplorationBreakdowns | Promise<ExplorationBreakdowns>;
  getExplorationScatter(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters
  ): ExplorationScatterPoint[] | Promise<ExplorationScatterPoint[]>;
  getExplorationEntities(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters
  ): ExplorationEntities | Promise<ExplorationEntities>;
  listExplorationMentions(
    session: import("@sac/auth").SessionContext,
    filters?: ExplorationFilters,
    options?: ExplorationMentionListOptions
  ): ExplorationMentionRow[] | Promise<ExplorationMentionRow[]>;
  listEnrichmentDefinitions():
    | EnrichmentDefinition[]
    | Promise<EnrichmentDefinition[]>;
  listMentions(
    session: import("@sac/auth").SessionContext,
    filters?: MentionFilters
  ): NormalizedMention[] | Promise<NormalizedMention[]>;
  listMentionsEnriched(
    session: import("@sac/auth").SessionContext,
    filters?: MentionFilters,
    options?: EnrichmentListOptions
  ): EnrichedMention[] | Promise<EnrichedMention[]>;
  getMentionEnrichments(
    session: import("@sac/auth").SessionContext,
    mentionId: string,
    options?: Pick<EnrichmentListOptions, "includeDisabled">
  ): EnrichedMention | Promise<EnrichedMention>;
  listEnrichmentRollups(
    session: import("@sac/auth").SessionContext,
    filters: EnrichmentRollupFilters
  ): EnrichmentRollup[] | Promise<EnrichmentRollup[]>;
  listAlerts(
    session: import("@sac/auth").SessionContext,
    agencyId?: string
  ): Alert[] | Promise<Alert[]>;
  listCases(
    session: import("@sac/auth").SessionContext,
    agencyId?: string
  ): Case[] | Promise<Case[]>;
  listAgencies(
    session: import("@sac/auth").SessionContext
  ): Agency[] | Promise<Agency[]>;
  listUsers(
    session: import("@sac/auth").SessionContext
  ): User[] | Promise<User[]>;
  listSavedFilters(
    session: import("@sac/auth").SessionContext,
    scope?: SavedFilter["scope"]
  ): SavedFilter[] | Promise<SavedFilter[]>;
  createCase(
    session: import("@sac/auth").SessionContext,
    input: CreateCaseInput
  ): Case | Promise<Case>;
  updateCase(
    session: import("@sac/auth").SessionContext,
    caseId: string,
    input: UpdateCaseInput
  ): Case | Promise<Case>;
  acknowledgeAlert(
    session: import("@sac/auth").SessionContext,
    alertId: string
  ): Alert | Promise<Alert>;
  upsertMentions(
    mentions: NormalizedMention[],
    run: Omit<
      BrandwatchSyncRun,
      "id" | "insertedCount" | "duplicateCount" | "status"
    >
  ):
    | { insertedCount: number; duplicateCount: number; createdAlerts: Alert[] }
    | Promise<{
        insertedCount: number;
        duplicateCount: number;
        createdAlerts: Alert[];
      }>;
  importBrandwatchWorkbook?(
    input: BrandwatchWorkbookImportInput
  ): Promise<ImportResult>;
};
