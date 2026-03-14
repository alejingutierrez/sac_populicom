import type {
  Agency,
  EnrichedMention,
  ExplorationBatchOption,
  ExplorationBoxplotStat,
  ExplorationBreakdownItem,
  ExplorationBreakdowns,
  ExplorationEntities,
  ExplorationEntityNode,
  ExplorationFilters,
  ExplorationHeatmapCell,
  ExplorationHistogramBin,
  ExplorationMentionListOptions,
  ExplorationMentionRow,
  ExplorationMeta,
  ExplorationMetaOption,
  ExplorationQueryOption,
  ExplorationScatterPoint,
  ExplorationSentimentByPlatform,
  ExplorationSummary,
  ExplorationTimeseriesGranularity,
  ExplorationTimeseriesPoint
} from "./types";

const TIME_ZONE = "America/Puerto_Rico";
const WEEKDAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;
const DAYPART_ORDER = ["madrugada", "mañana", "tarde", "noche"] as const;
const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo"
};
const DAYPART_LABELS: Record<string, string> = {
  madrugada: "Madrugada",
  mañana: "Mañana",
  tarde: "Tarde",
  noche: "Noche"
};

type ExplorationSeed = {
  mentions: EnrichedMention[];
  agencies: Agency[];
  batchDetails?: Array<{
    id: string;
    label?: string;
    createdAt?: string;
    from?: string;
    to?: string;
    queryId?: string;
    queryLabel?: string;
  }>;
  queryDetails?: Array<{
    id: string;
    label?: string;
  }>;
};

type LocalParts = {
  localDate: string;
  localHour: number;
  localWeekday: string;
  localDayPart: string;
};

const first = <TValue>(values: TValue[]) => values[0];

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const safeAverage = (values: number[]) =>
  values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2)
    : 0;

const localPartsFromIso = (isoDate: string): LocalParts => {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long"
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  const localHour = Number(get("hour") || 0);
  const localWeekday = get("weekday").toLowerCase();
  const localDayPart =
    localHour < 6
      ? "madrugada"
      : localHour < 12
        ? "mañana"
        : localHour < 18
          ? "tarde"
          : "noche";

  return {
    localDate,
    localHour,
    localWeekday,
    localDayPart
  };
};

const dayDifference = (left?: string, right?: string) => {
  if (!left || !right) {
    return 0;
  }

  const diffMs = new Date(right).getTime() - new Date(left).getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};

const getCountry = (mention: EnrichedMention) => {
  const composite = asString(mention.enrichments.country_region_city_key);
  if (!composite) {
    return "Unknown";
  }

  const [country] = composite.split("|");
  return !country || country.toLowerCase() === "unknown" ? "Unknown" : country;
};

const getPlatformFamily = (mention: EnrichedMention) =>
  asString(mention.enrichments.platform_family) ?? mention.channel ?? "Unknown";

const getSourceClass = (mention: EnrichedMention) =>
  asString(mention.enrichments.source_class) ?? mention.source ?? "unknown";

const getRiskBaseScore = (mention: EnrichedMention) =>
  asNumber(mention.enrichments.risk_base_score) ?? 0;

const getEarnedAttentionIndex = (mention: EnrichedMention) =>
  asNumber(mention.enrichments.earned_attention_index) ?? 0;

const getCaptureLatencyMinutes = (mention: EnrichedMention) =>
  asNumber(mention.enrichments.capture_latency_minutes) ?? 0;

const getTotalInteractionsBase = (mention: EnrichedMention) =>
  asNumber(mention.enrichments.total_interactions_base) ??
  mention.engagement.likes +
    mention.engagement.comments +
    mention.engagement.shares;

const getDomain = (mention: EnrichedMention) =>
  asString(mention.enrichments.normalized_url_host) ?? "Sin dominio";

const getBatchId = (mention: EnrichedMention) =>
  mention.enrichmentMeta?.batchId;
const getQueryId = (mention: EnrichedMention) =>
  mention.enrichmentMeta?.queryId;

const countBy = <TValue>(
  items: TValue[],
  keyer: (item: TValue) => string,
  labeler?: (item: TValue) => string
) => {
  const map = new Map<string, { key: string; label: string; count: number }>();

  for (const item of items) {
    const key = keyer(item) || "Unknown";
    const current = map.get(key);
    if (current) {
      current.count += 1;
      continue;
    }

    map.set(key, {
      key,
      label: labeler?.(item) ?? key,
      count: 1
    });
  }

  return [...map.values()].sort((left, right) => right.count - left.count);
};

const withShare = (
  items: Array<{ key: string; label: string; count: number }>
): ExplorationBreakdownItem[] => {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return items.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    share: total ? round(item.count / total, 4) : 0
  }));
};

const toMetaOptions = (
  items: Array<{ key: string; label: string; count: number }>
): ExplorationMetaOption[] =>
  items.map((item) => ({
    value: item.key,
    label: item.label,
    count: item.count
  }));

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * ratio))
  );

  return sorted[index];
};

const buildBoxplotStats = (
  mentions: EnrichedMention[]
): ExplorationBoxplotStat[] =>
  countBy(mentions, getPlatformFamily, getPlatformFamily).map((item) => {
    const values = mentions
      .filter((mention) => getPlatformFamily(mention) === item.key)
      .map(getTotalInteractionsBase)
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);

    if (values.length === 0) {
      return {
        key: item.key,
        label: item.label,
        count: 0,
        min: 0,
        q1: 0,
        median: 0,
        q3: 0,
        max: 0,
        outliers: []
      };
    }

    const q1 = percentile(values, 0.25);
    const median = percentile(values, 0.5);
    const q3 = percentile(values, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - iqr * 1.5;
    const upperFence = q3 + iqr * 1.5;
    const nonOutliers = values.filter(
      (value) => value >= lowerFence && value <= upperFence
    );
    const min = first(nonOutliers) ?? first(values) ?? 0;
    const max = nonOutliers[nonOutliers.length - 1] ?? values.at(-1) ?? 0;

    return {
      key: item.key,
      label: item.label,
      count: values.length,
      min,
      q1,
      median,
      q3,
      max,
      outliers: values
        .filter((value) => value < lowerFence || value > upperFence)
        .slice(0, 12)
    };
  });

const buildHistogram = (values: number[]): ExplorationHistogramBin[] => {
  const max = Math.max(...values, 0);
  const bucketCount = Math.min(
    8,
    Math.max(4, Math.ceil(Math.sqrt(values.length || 1)))
  );
  const bucketSize = max / bucketCount || 1;

  return Array.from({ length: bucketCount }, (_, index) => {
    const x0 = round(index * bucketSize, 2);
    const x1 = round(x0 + bucketSize, 2);
    return {
      x0,
      x1,
      count: values.filter((value) => value >= x0 && value < x1).length
    };
  });
};

const sortMentions = (
  mentions: EnrichedMention[],
  sort: NonNullable<ExplorationMentionListOptions["sort"]>
) => {
  if (sort === "occurred_desc") {
    return [...mentions].sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt)
    );
  }

  return [...mentions].sort((left, right) => {
    const attentionDelta =
      getEarnedAttentionIndex(right) - getEarnedAttentionIndex(left);
    if (attentionDelta !== 0) {
      return attentionDelta;
    }

    return right.occurredAt.localeCompare(left.occurredAt);
  });
};

const mentionMatchesExplorationFilters = (
  mention: EnrichedMention,
  filters: ExplorationFilters
) => {
  if (filters.agencyId && mention.agencyId !== filters.agencyId) {
    return false;
  }

  if (filters.source && mention.source !== filters.source) {
    return false;
  }

  if (filters.sentiment && mention.sentiment !== filters.sentiment) {
    return false;
  }

  if (filters.priority && mention.priority !== filters.priority) {
    return false;
  }

  if (filters.language && mention.language !== filters.language) {
    return false;
  }

  if (filters.q) {
    const haystack = [
      mention.title,
      mention.body,
      mention.authorName,
      getDomain(mention),
      getCountry(mention)
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(filters.q.toLowerCase())) {
      return false;
    }
  }

  if (filters.from && mention.occurredAt < filters.from) {
    return false;
  }

  if (filters.to && mention.occurredAt > filters.to) {
    return false;
  }

  if (
    filters.platformFamily &&
    getPlatformFamily(mention) !== filters.platformFamily
  ) {
    return false;
  }

  if (filters.sourceClass && getSourceClass(mention) !== filters.sourceClass) {
    return false;
  }

  if (filters.country && getCountry(mention) !== filters.country) {
    return false;
  }

  if (filters.batchId && getBatchId(mention) !== filters.batchId) {
    return false;
  }

  if (filters.sourceQueryId && getQueryId(mention) !== filters.sourceQueryId) {
    return false;
  }

  return true;
};

const buildBatchOptions = (
  mentions: EnrichedMention[],
  batchDetails: ExplorationSeed["batchDetails"] = []
): ExplorationBatchOption[] => {
  const detailById = new Map(batchDetails.map((batch) => [batch.id, batch]));

  return countBy(
    mentions.filter((mention) => getBatchId(mention)),
    (mention) => getBatchId(mention) ?? "unknown"
  )
    .map((item) => {
      const scoped = mentions.filter(
        (mention) => getBatchId(mention) === item.key
      );
      const detail = detailById.get(item.key);
      const occurred = scoped.map((mention) => mention.occurredAt).sort();
      const received = scoped.map((mention) => mention.receivedAt).sort();
      return {
        id: item.key,
        label:
          detail?.label ??
          detail?.queryLabel ??
          `Batch ${item.key.slice(0, 8)}`,
        createdAt:
          detail?.createdAt ?? received[received.length - 1] ?? undefined,
        from: detail?.from ?? first(occurred),
        to: detail?.to ?? occurred[occurred.length - 1],
        queryId:
          detail?.queryId ?? first(scoped.map(getQueryId).filter(Boolean)),
        queryLabel: detail?.queryLabel,
        count: item.count
      };
    })
    .sort((left, right) =>
      (right.createdAt ?? right.to ?? "").localeCompare(
        left.createdAt ?? left.to ?? ""
      )
    );
};

const buildQueryOptions = (
  mentions: EnrichedMention[],
  queryDetails: ExplorationSeed["queryDetails"] = []
): ExplorationQueryOption[] => {
  const detailById = new Map(queryDetails.map((query) => [query.id, query]));

  return countBy(
    mentions.filter((mention) => getQueryId(mention)),
    (mention) => getQueryId(mention) ?? "unknown"
  )
    .map((item) => ({
      id: item.key,
      label: detailById.get(item.key)?.label ?? item.key,
      count: item.count
    }))
    .sort((left, right) => right.count - left.count);
};

export const buildExplorationMeta = (
  seed: ExplorationSeed,
  filters: Pick<ExplorationFilters, "agencyId"> = {}
): ExplorationMeta => {
  const scoped = seed.mentions.filter((mention) =>
    mentionMatchesExplorationFilters(mention, {
      agencyId: filters.agencyId
    })
  );
  const batches = buildBatchOptions(scoped, seed.batchDetails);
  const queries = buildQueryOptions(scoped, seed.queryDetails);
  const latestBatch = first(batches);
  const lastIngestedAt = scoped
    .map((mention) => mention.receivedAt)
    .sort()
    .at(-1);

  return {
    defaults: {
      agencyId: filters.agencyId ?? first(seed.agencies)?.id ?? "pr-central",
      batchId: latestBatch?.id,
      from: latestBatch?.from,
      to: latestBatch?.to
    },
    lastIngestedAt,
    agencies: seed.agencies,
    batches,
    queries,
    sourceClasses: toMetaOptions(
      countBy(scoped, getSourceClass, getSourceClass)
    ),
    platformFamilies: toMetaOptions(
      countBy(scoped, getPlatformFamily, getPlatformFamily)
    ),
    languages: toMetaOptions(countBy(scoped, (mention) => mention.language)),
    countries: toMetaOptions(countBy(scoped, getCountry, getCountry)),
    sentiments: toMetaOptions(countBy(scoped, (mention) => mention.sentiment)),
    priorities: toMetaOptions(countBy(scoped, (mention) => mention.priority))
  };
};

export const filterExplorationMentions = (
  mentions: EnrichedMention[],
  filters: ExplorationFilters = {}
) =>
  mentions.filter((mention) =>
    mentionMatchesExplorationFilters(mention, filters)
  );

export const resolveExplorationGranularity = (
  mentions: EnrichedMention[],
  filters: ExplorationFilters = {}
): ExplorationTimeseriesGranularity => {
  const explicitRange = dayDifference(filters.from, filters.to);
  if (explicitRange > 0) {
    return explicitRange <= 3 ? "hour" : "day";
  }

  const sorted = mentions.map((mention) => mention.occurredAt).sort();
  const inferredRange = dayDifference(first(sorted), sorted.at(-1));
  return inferredRange <= 3 ? "hour" : "day";
};

export const buildExplorationSummary = (
  mentions: EnrichedMention[],
  filters: ExplorationFilters = {}
): ExplorationSummary => ({
  totalMentions: mentions.length,
  negativeMentions: mentions.filter(
    (mention) => mention.sentiment === "negative"
  ).length,
  criticalMentions: mentions.filter((mention) => mention.isCritical).length,
  avgRiskBaseScore: safeAverage(mentions.map(getRiskBaseScore)),
  avgEarnedAttentionIndex: safeAverage(mentions.map(getEarnedAttentionIndex)),
  avgCaptureLatencyMinutes: safeAverage(mentions.map(getCaptureLatencyMinutes)),
  selectedRange: {
    from: filters.from,
    to: filters.to
  },
  batchId: filters.batchId,
  queryId: filters.sourceQueryId,
  lastIngestedAt: mentions
    .map((mention) => mention.receivedAt)
    .sort()
    .at(-1)
});

export const buildExplorationTimeseries = (
  mentions: EnrichedMention[],
  granularity: ExplorationTimeseriesGranularity
): ExplorationTimeseriesPoint[] => {
  const buckets = new Map<
    string,
    ExplorationTimeseriesPoint & { sortKey: string }
  >();

  for (const mention of mentions) {
    const parts = localPartsFromIso(mention.occurredAt);
    const key =
      granularity === "hour"
        ? `${parts.localDate}T${String(parts.localHour).padStart(2, "0")}:00`
        : parts.localDate;
    const label =
      granularity === "hour"
        ? `${parts.localDate} ${String(parts.localHour).padStart(2, "0")}:00`
        : parts.localDate;
    const current = buckets.get(key) ?? {
      bucket: key,
      label,
      totalCount: 0,
      negativeCount: 0,
      criticalCount: 0,
      platformCounts: {},
      sortKey: key
    };
    const platformFamily = getPlatformFamily(mention);

    current.totalCount += 1;
    current.negativeCount += mention.sentiment === "negative" ? 1 : 0;
    current.criticalCount += mention.isCritical ? 1 : 0;
    current.platformCounts[platformFamily] =
      (current.platformCounts[platformFamily] ?? 0) + 1;
    buckets.set(key, current);
  }

  return [...buckets.values()]
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map((entry) => ({
      bucket: entry.bucket,
      label: entry.label,
      totalCount: entry.totalCount,
      negativeCount: entry.negativeCount,
      criticalCount: entry.criticalCount,
      platformCounts: entry.platformCounts
    }));
};

export const buildExplorationHeatmap = (
  mentions: EnrichedMention[]
): ExplorationHeatmapCell[] => {
  const cells = new Map<string, ExplorationHeatmapCell>();

  for (const mention of mentions) {
    const weekday =
      asString(mention.enrichments.occurred_weekday_pr) ??
      localPartsFromIso(mention.occurredAt).localWeekday;
    const daypart =
      asString(mention.enrichments.occurred_daypart) ??
      localPartsFromIso(mention.occurredAt).localDayPart;
    const key = `${weekday}|${daypart}`;
    const current = cells.get(key) ?? {
      weekday,
      daypart,
      count: 0
    };
    current.count += 1;
    cells.set(key, current);
  }

  return [...cells.values()].sort((left, right) => {
    const weekdayDelta =
      WEEKDAY_ORDER.indexOf(left.weekday as (typeof WEEKDAY_ORDER)[number]) -
      WEEKDAY_ORDER.indexOf(right.weekday as (typeof WEEKDAY_ORDER)[number]);
    if (weekdayDelta !== 0) {
      return weekdayDelta;
    }

    return (
      DAYPART_ORDER.indexOf(left.daypart as (typeof DAYPART_ORDER)[number]) -
      DAYPART_ORDER.indexOf(right.daypart as (typeof DAYPART_ORDER)[number])
    );
  });
};

export const buildExplorationBreakdowns = (
  mentions: EnrichedMention[]
): ExplorationBreakdowns => {
  const sentimentByPlatform: ExplorationSentimentByPlatform[] = countBy(
    mentions,
    getPlatformFamily,
    getPlatformFamily
  ).map((platform) => {
    const scoped = mentions.filter(
      (mention) => getPlatformFamily(mention) === platform.key
    );
    return {
      platformFamily: platform.label,
      positive: scoped.filter((mention) => mention.sentiment === "positive")
        .length,
      neutral: scoped.filter((mention) => mention.sentiment === "neutral")
        .length,
      negative: scoped.filter((mention) => mention.sentiment === "negative")
        .length,
      mixed: scoped.filter((mention) => mention.sentiment === "mixed").length,
      total: scoped.length
    };
  });

  return {
    platformFamily: withShare(
      countBy(mentions, getPlatformFamily, getPlatformFamily)
    ),
    country: withShare(countBy(mentions, getCountry, getCountry)).slice(0, 10),
    language: withShare(
      countBy(
        mentions,
        (mention) => mention.language || "unknown",
        (mention) =>
          mention.language === "es"
            ? "Español"
            : mention.language === "en"
              ? "Inglés"
              : mention.language || "Other"
      )
    ),
    sentimentByPlatform,
    interactionBoxplotByPlatform: buildBoxplotStats(mentions),
    latencyHistogram: buildHistogram(mentions.map(getCaptureLatencyMinutes))
  };
};

export const buildExplorationScatter = (
  mentions: EnrichedMention[]
): ExplorationScatterPoint[] =>
  sortMentions(mentions, "earned_attention_desc")
    .filter(
      (mention) =>
        Number.isFinite(getRiskBaseScore(mention)) &&
        Number.isFinite(getEarnedAttentionIndex(mention))
    )
    .slice(0, 180)
    .map((mention) => ({
      id: mention.id,
      title: mention.title ?? mention.body.slice(0, 80),
      platformFamily: getPlatformFamily(mention),
      sentiment: mention.sentiment,
      riskBaseScore: getRiskBaseScore(mention),
      earnedAttentionIndex: getEarnedAttentionIndex(mention),
      totalInteractionsBase: getTotalInteractionsBase(mention),
      isCritical: mention.isCritical
    }));

export const buildExplorationMentionRows = (
  mentions: EnrichedMention[],
  options: ExplorationMentionListOptions = {}
): ExplorationMentionRow[] => {
  const sorted = sortMentions(
    mentions,
    options.sort ?? "earned_attention_desc"
  );
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 25;

  return sorted.slice(offset, offset + limit).map((mention) => ({
    id: mention.id,
    title: mention.title ?? "Mención sin título",
    bodyPreview: mention.body.slice(0, 180),
    url: mention.url,
    platformFamily: getPlatformFamily(mention),
    sourceClass: getSourceClass(mention),
    sentiment: mention.sentiment,
    priority: mention.priority,
    authorName: mention.authorName,
    occurredAt: mention.occurredAt,
    country: getCountry(mention),
    earnedAttentionIndex: getEarnedAttentionIndex(mention),
    riskBaseScore: getRiskBaseScore(mention),
    totalInteractionsBase: getTotalInteractionsBase(mention),
    isCritical: mention.isCritical
  }));
};

export const buildExplorationEntities = (
  mentions: EnrichedMention[]
): ExplorationEntities => {
  const topPublicationsOrDomains: ExplorationEntityNode[] = countBy(
    mentions,
    getDomain,
    getDomain
  )
    .slice(0, 15)
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: item.count
    }));

  return {
    topPublicationsOrDomains,
    mentionTable: buildExplorationMentionRows(mentions)
  };
};

export const formatWeekdayLabel = (weekday: string) =>
  WEEKDAY_LABELS[weekday] ?? weekday;

export const formatDaypartLabel = (daypart: string) =>
  DAYPART_LABELS[daypart] ?? daypart;
