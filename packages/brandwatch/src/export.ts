import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  BrandwatchExportMetadata,
  BrandwatchWorkbookImportInput,
  CanonicalMentionImport,
  MentionAttribute,
  MentionMetric,
  MentionSource
} from "@sac/db";
import * as XLSX from "xlsx";

type BrandwatchExportCell = string | number | boolean | null;
type BrandwatchExportRow = Record<string, BrandwatchExportCell>;
type ParsedRow = {
  rowNumber: number;
  values: BrandwatchExportRow;
};

export type BrandwatchColumnClassification =
  | "identifier"
  | "dimension"
  | "metric"
  | "flag"
  | "raw-only";

export type BrandwatchDataDictionaryColumn = {
  name: string;
  family: string;
  inferredType: "string" | "number" | "boolean" | "mixed" | "empty";
  coverage: number;
  nonNullCount: number;
  uniqueCount: number;
  classification: BrandwatchColumnClassification;
  destination: string;
  transformation: string;
  use: string;
  description: string;
};

export type BrandwatchExportWorkbook = {
  metadata: BrandwatchExportMetadata;
  columns: string[];
  rows: ParsedRow[];
  checksum: string;
};

const HEADER_SIGNATURE_COLUMNS = [
  "Query Id",
  "Query Name",
  "Date",
  "Title",
  "Snippet",
  "Url"
];

const identifierColumns = new Set([
  "Query Id",
  "Mention Id",
  "Resource Id",
  "Url",
  "Original Url",
  "Thread Id",
  "Publication Id",
  "Asset Content Id",
  "Asset Thumb Id",
  "X Author ID",
  "Facebook Author ID",
  "Bluesky Author Id",
  "Parent Post Id",
  "Root Post Id",
  "Subreddit",
  "Thread URL"
]);

const metricColumns = new Set([
  "Impressions",
  "Reach (new)",
  "Potential Audience",
  "Social Shares",
  "Total Monthly Visitors",
  "Daily Visitors",
  "Viewership",
  "Ad Value",
  "Circulation",
  "Comments",
  "Likes",
  "Shares",
  "Podcast Audience Estimate",
  "Podcast Duration Ms",
  "Resource Views",
  "Impact",
  "Engagement Score",
  "Subscriptions",
  "Subreddit Subscribers",
  "React Score Overall",
  "React Score Emotionality",
  "React Score Harmful",
  "Facebook Comments",
  "Facebook Likes",
  "Facebook Shares",
  "Instagram Comments",
  "Instagram Followers",
  "Instagram Following",
  "Instagram Interactions Count",
  "Instagram Likes",
  "Instagram Posts",
  "Linkedin Comments",
  "Linkedin Engagement",
  "Linkedin Impressions",
  "Linkedin Likes",
  "Linkedin Shares",
  "Linkedin Video Views",
  "Reddit Score",
  "Reddit Score Upvote Ratio",
  "Reddit Comments",
  "Reddit Author Karma",
  "Threads Likes",
  "Threads Quotes",
  "Threads Replies",
  "Threads Reposts",
  "Threads Shares",
  "Threads Views",
  "Tiktok Comments",
  "Tiktok Likes",
  "Tiktok Reach",
  "Tiktok Shares",
  "Tiktok Views",
  "X Followers",
  "X Following",
  "X Replies",
  "X Reposts",
  "X Likes",
  "X Posts",
  "Youtube Comments",
  "Youtube Duration Milliseconds",
  "Youtube Favourites",
  "Youtube Likes",
  "Youtube Subscriber Count",
  "Youtube Video Count",
  "Bluesky Followers",
  "Bluesky Following",
  "Bluesky Likes",
  "Bluesky Posts",
  "Bluesky Quotes",
  "Bluesky Replies",
  "Bluesky Reposts"
]);

const flagColumns = new Set([
  "Checked",
  "Starred",
  "X Verified",
  "Can Edit Markup",
  "Can Edit Metadata",
  "Can Edit Segmentation",
  "Can Edit Workflow",
  "Has Full Text",
  "Is Syndicated",
  "Reportable",
  "Redacted",
  "Reddit Spoiler",
  "Subreddit NSFW",
  "Linkedin Sponsored",
  "Tiktok Connected Account"
]);

const authorColumns = new Set([
  "Author",
  "Full Name",
  "Author Verified Type",
  "Avatar",
  "Account Type",
  "Gender",
  "Facebook Role",
  "X Channel Role",
  "Facebook Author ID",
  "X Author ID",
  "Bluesky Author Id"
]);

const geographyColumns = new Set([
  "Continent Code",
  "Continent",
  "Country Code",
  "Country",
  "Region Code",
  "Region",
  "City Code",
  "City",
  "Location Name",
  "Latitude",
  "Longitude"
]);

const publicationColumns = new Set([
  "Publication Name",
  "Publication Id",
  "Domain",
  "Blog Name",
  "Parent Blog Name",
  "Root Blog Name",
  "Pub Type",
  "Publisher Sub Type",
  "Media Type",
  "Page Type",
  "Page Type Name",
  "Unified Source Name",
  "Content Source",
  "Content Source Name"
]);

const threadColumns = new Set([
  "Thread Author",
  "Thread Created Date",
  "Thread Entry Type",
  "Thread Id",
  "Thread URL",
  "Parent Post Id",
  "Root Post Id"
]);

const rawOnlyColumns = new Set([
  "Raw Metadata",
  "Custom",
  "Copyright",
  "Factiva Attribute Code",
  "Licenses",
  "Broadcast Media Url",
  "Display URLs"
]);

const canonicalAttributeExclusions = new Set([
  "Query Id",
  "Query Name",
  "Date",
  "Title",
  "Snippet",
  "Full Text",
  "Url",
  "Language",
  "Sentiment",
  "Page Type",
  "Content Source Name",
  "Unified Source Name",
  "Author",
  "Full Name",
  "Thread Author",
  "Mention Id",
  "Resource Id",
  "Original Url",
  "Added",
  "Updated",
  "Country",
  "Country Code",
  "Region",
  "Region Code",
  "City",
  "City Code",
  "Location Name",
  "Latitude",
  "Longitude",
  "Continent",
  "Continent Code"
]);

const explicitDescriptions: Record<string, string> = {
  "Query Id":
    "Identificador técnico de la query de Brandwatch que originó la extracción.",
  "Query Name": "Nombre legible de la query o monitor de Brandwatch.",
  Date: "Fecha/hora original de publicación o detección de la mención.",
  Title: "Título o encabezado capturado por Brandwatch.",
  Snippet: "Resumen corto o extracto del contenido.",
  "Full Text":
    "Texto completo normalizado de la mención cuando está disponible.",
  Url: "URL principal de la mención capturada.",
  "Original Url":
    "URL original de origen, útil cuando la mención es share/repost o URL expandida.",
  "Mention Id":
    "Identificador de mención de Brandwatch. Puede faltar en algunos orígenes como Reddit.",
  "Resource Id":
    "Identificador del recurso fuente dentro de Brandwatch. Se usa como fallback de deduplicación.",
  Sentiment: "Sentimiento calculado por Brandwatch para la mención.",
  "Page Type": "Tipo técnico de fuente/origen dentro de Brandwatch.",
  "Content Source Name": "Nombre normalizado de la plataforma de origen.",
  "Unified Source Name":
    "Nombre unificado de la plataforma o publisher usado por Brandwatch.",
  Language: "Idioma detectado del contenido.",
  Author: "Nombre corto o handle del autor.",
  "Full Name": "Nombre expandido del autor o cuenta.",
  "Thread Entry Type":
    "Posición del contenido dentro del hilo: post, reply, share, etc.",
  "Potential Audience":
    "Audiencia potencial estimada por Brandwatch para la mención.",
  "Reach (new)": "Alcance estimado actualizado por Brandwatch.",
  Impact: "Puntaje de impacto del contenido según Brandwatch.",
  "Engagement Score": "Score agregado de interacción calculado por Brandwatch.",
  Impressions: "Impresiones observadas o estimadas para la mención.",
  Likes:
    "Likes genéricos de la mención cuando Brandwatch los expone en una columna transversal.",
  Comments:
    "Comentarios genéricos de la mención cuando Brandwatch los expone en una columna transversal.",
  Shares:
    "Compartidos genéricos de la mención cuando Brandwatch los expone en una columna transversal.",
  Hashtags: "Hashtags detectados en el contenido.",
  Emotion: "Etiqueta de emoción inferida para la mención."
};

const normalizeCell = (value: unknown): BrandwatchExportCell => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
};

const detectHeaderRowIndex = (matrix: BrandwatchExportCell[][]) => {
  for (
    let rowIndex = 0;
    rowIndex < Math.min(matrix.length, 12);
    rowIndex += 1
  ) {
    const row = matrix[rowIndex] ?? [];
    const normalized = new Set(
      row.map((value) => String(value ?? "").trim()).filter(Boolean)
    );
    const matches = HEADER_SIGNATURE_COLUMNS.filter((column) =>
      normalized.has(column)
    ).length;

    if (matches >= 4) {
      return rowIndex;
    }
  }

  return 6;
};

const asString = (value: BrandwatchExportCell) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const next = String(value).trim();
  return next ? next : undefined;
};

const normalizeDateValue = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    return new Date(raw.replace(" ", "T") + "Z").toISOString();
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return raw;
};

const asNumber = (value: BrandwatchExportCell) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const next = Number(value);
    return Number.isFinite(next) ? next : undefined;
  }

  return undefined;
};

const splitList = (value?: string) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const inferFamily = (column: string) => {
  const prefixes = [
    "Facebook",
    "Instagram",
    "Linkedin",
    "Reddit",
    "Threads",
    "Tiktok",
    "Youtube",
    "Bluesky",
    "X"
  ];
  for (const prefix of prefixes) {
    if (column.startsWith(`${prefix} `)) {
      return prefix;
    }
  }
  if (column.startsWith("React Score ")) {
    return "React Score";
  }
  return "Core";
};

const inferClassification = (
  column: string
): BrandwatchColumnClassification => {
  if (identifierColumns.has(column)) {
    return "identifier";
  }
  if (metricColumns.has(column)) {
    return "metric";
  }
  if (flagColumns.has(column)) {
    return "flag";
  }
  if (rawOnlyColumns.has(column)) {
    return "raw-only";
  }
  return "dimension";
};

const inferPrimitiveType = (
  values: BrandwatchExportCell[]
): BrandwatchDataDictionaryColumn["inferredType"] => {
  const nonNull = values.filter((value) => value !== null);
  if (nonNull.length === 0) {
    return "empty";
  }
  const kinds = new Set(nonNull.map((value) => typeof value));
  if (kinds.size === 1) {
    const [kind] = [...kinds];
    if (kind === "string" || kind === "number" || kind === "boolean") {
      return kind;
    }
  }
  return "mixed";
};

const inferDestination = (
  column: string,
  classification: BrandwatchColumnClassification
) => {
  if (column === "Query Id" || column === "Query Name") {
    return "source_queries";
  }
  if (column === "Date") {
    return "mentions.occurred_at";
  }
  if (column === "Added" || column === "Updated") {
    return "mentions.received_at";
  }
  if (column === "Title") {
    return "mentions.title";
  }
  if (column === "Full Text" || column === "Snippet") {
    return "mentions.body";
  }
  if (column === "Url") {
    return "mentions.url";
  }
  if (column === "Sentiment") {
    return "mentions.sentiment";
  }
  if (column === "Language") {
    return "mentions.language";
  }
  if (
    column === "Page Type" ||
    column === "Content Source Name" ||
    column === "Unified Source Name"
  ) {
    return "mentions.source/channel";
  }
  if (authorColumns.has(column)) {
    return "authors";
  }
  if (publicationColumns.has(column)) {
    return "publications";
  }
  if (threadColumns.has(column)) {
    return "mention_threads";
  }
  if (geographyColumns.has(column)) {
    return "geographies";
  }
  if (classification === "metric") {
    return "mention_metrics";
  }
  if (classification === "identifier") {
    return "mention_raw_rows / mentions.external_id";
  }
  if (classification === "flag" || classification === "raw-only") {
    return "mention_attributes";
  }
  return "mention_attributes";
};

const inferTransformation = (
  column: string,
  classification: BrandwatchColumnClassification
) => {
  if (column === "Mention Id") {
    return "Clave principal preferida para deduplicación.";
  }
  if (column === "Resource Id") {
    return "Fallback de clave externa cuando falta Mention Id.";
  }
  if (column === "Url") {
    return "Último fallback de clave externa y enlace principal de navegación.";
  }
  if (column === "Full Text") {
    return "Se usa como cuerpo canónico; fallback a Snippet o Title.";
  }
  if (column === "Title") {
    return "Se preserva como título canónico cuando existe.";
  }
  if (column === "Added" || column === "Updated") {
    return "Se usa para receivedAt con preferencia por Updated.";
  }
  if (classification === "metric") {
    return "Se persiste como métrica angosta por mention_id y source_column.";
  }
  if (classification === "flag") {
    return "Se persiste como atributo booleano o de cumplimiento.";
  }
  if (classification === "identifier") {
    return "Se preserva íntegro para trazabilidad y deduplicación.";
  }
  return "Se preserva como dimensión o atributo auxiliar según su función analítica.";
};

const inferUse = (
  column: string,
  classification: BrandwatchColumnClassification
) => {
  if (column === "Sentiment") {
    return "Filtro operativo, priorización y generación de alertas.";
  }
  if (column === "Page Type" || column === "Content Source Name") {
    return "Clasificación de fuente y agregación por canal.";
  }
  if (
    column === "Potential Audience" ||
    column === "Reach (new)" ||
    column === "Impact"
  ) {
    return "Análisis de alcance e impacto.";
  }
  if (column === "Hashtags" || column === "Emotion") {
    return "Enriquecimiento temático y exploración semántica.";
  }
  if (classification === "metric") {
    return "Métrica analítica para reporting y comparativos por plataforma.";
  }
  if (classification === "identifier") {
    return "Trazabilidad técnica, joins y deduplicación.";
  }
  if (classification === "flag") {
    return "Control editorial, compliance o workflow.";
  }
  if (classification === "raw-only") {
    return "Retención completa del payload original sin uso principal en UI.";
  }
  return "Dimensión descriptiva para filtros, drill-down y contexto operativo.";
};

const inferDescription = (
  column: string,
  family: string,
  classification: BrandwatchColumnClassification
) => {
  if (explicitDescriptions[column]) {
    return explicitDescriptions[column];
  }

  const [, suffix] = column.includes(" ")
    ? column.split(/ (.+)/)
    : [column, column];

  if (classification === "metric" && family !== "Core") {
    return `Métrica específica de ${family} capturada por Brandwatch para la mención o la cuenta autora (${suffix}).`;
  }

  if (classification === "flag") {
    return `Indicador booleano o bandera de estado para ${column}.`;
  }

  if (classification === "identifier") {
    return `Identificador técnico asociado a ${column}.`;
  }

  if (family !== "Core") {
    return `Atributo específico de ${family} capturado por Brandwatch (${suffix}).`;
  }

  return `Campo descriptivo de Brandwatch utilizado para contexto, segmentación o trazabilidad (${column}).`;
};

const toMetricEntries = (
  row: BrandwatchExportRow
): Array<Omit<MentionMetric, "id" | "mentionId" | "createdAt">> =>
  Object.entries(row).flatMap(([column, value]) => {
    if (!metricColumns.has(column)) {
      return [];
    }

    const numericValue = asNumber(value);
    if (numericValue === undefined) {
      return [];
    }

    return [
      {
        metricName: column,
        metricValue: numericValue,
        platform: inferFamily(column),
        sourceColumn: column,
        unit: column.includes("Duration")
          ? "milliseconds"
          : column.includes("Audience") ||
              column.includes("Visitors") ||
              column.includes("Followers")
            ? "count"
            : undefined
      }
    ];
  });

const inferAttributeValueType = (
  value: BrandwatchExportCell
): MentionAttribute["valueType"] => {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  ) {
    return "url";
  }
  if (typeof value === "string" && value.includes(", ")) {
    return "list";
  }
  if (
    typeof value === "string" &&
    (value.includes("T") || value.includes("UTC"))
  ) {
    return "date";
  }
  return "string";
};

const toAttributeEntries = (
  row: BrandwatchExportRow
): Array<Omit<MentionAttribute, "id" | "mentionId" | "createdAt">> =>
  Object.entries(row)
    .filter(
      ([column, value]) =>
        value !== null &&
        !metricColumns.has(column) &&
        !canonicalAttributeExclusions.has(column)
    )
    .map(([column, value]) => ({
      attributeName: column,
      attributeValue: String(value),
      valueType: inferAttributeValueType(value),
      platform: inferFamily(column),
      sourceColumn: column
    }));

const chooseMetric = (row: BrandwatchExportRow, columns: string[]) => {
  for (const column of columns) {
    const value = asNumber(row[column]);
    if (value !== undefined) {
      return value;
    }
  }
  return 0;
};

const mapSource = (pageType?: string): MentionSource => {
  if (pageType === "news") {
    return "news";
  }
  if (["blog", "forum"].includes(pageType ?? "")) {
    return "web";
  }
  return "social";
};

const canonicalExternalId = (row: BrandwatchExportRow) =>
  asString(row["Mention Id"]) ??
  asString(row["Resource Id"]) ??
  asString(row.Url) ??
  `row-${randomUUID()}`;

const buildAuthor = (row: BrandwatchExportRow) => {
  const platform =
    asString(row["Content Source Name"]) ??
    asString(row["Page Type"]) ??
    "Unknown";
  const profile = {
    platform,
    sourceAuthorId:
      asString(row["X Author ID"]) ??
      asString(row["Facebook Author ID"]) ??
      asString(row["Bluesky Author Id"]),
    name: asString(row.Author),
    handle: asString(row.Author),
    fullName: asString(row["Full Name"]),
    accountType: asString(row["Account Type"]),
    verifiedType:
      asString(row["Author Verified Type"]) ?? asString(row["X Verified"]),
    avatarUrl: asString(row.Avatar),
    followers: chooseMetric(row, [
      "X Followers",
      "Instagram Followers",
      "Bluesky Followers",
      "Youtube Subscriber Count"
    ]),
    following: chooseMetric(row, [
      "X Following",
      "Instagram Following",
      "Bluesky Following"
    ]),
    posts: chooseMetric(row, [
      "X Posts",
      "Instagram Posts",
      "Bluesky Posts",
      "Youtube Video Count"
    ]),
    rawProfile: undefined
  };

  return Object.values(profile).some(
    (value) => value !== undefined && value !== 0 && value !== "Unknown"
  )
    ? profile
    : undefined;
};

const buildPublication = (row: BrandwatchExportRow) => {
  const publication = {
    platform:
      asString(row["Content Source Name"]) ??
      asString(row["Page Type"]) ??
      "Unknown",
    sourcePublicationId: asString(row["Publication Id"]),
    name:
      asString(row["Publication Name"]) ??
      asString(row["Blog Name"]) ??
      asString(row.Domain),
    domain: asString(row.Domain),
    pageType: asString(row["Page Type"]),
    pubType: asString(row["Pub Type"]),
    publisherSubtype: asString(row["Publisher Sub Type"]),
    blogName: asString(row["Blog Name"]),
    subreddit: asString(row.Subreddit),
    subscribers: chooseMetric(row, ["Subreddit Subscribers", "Subscriptions"]),
    dailyVisitors: asNumber(row["Daily Visitors"]),
    totalMonthlyVisitors: asNumber(row["Total Monthly Visitors"])
  };

  return Object.values(publication).some(
    (value) => value !== undefined && value !== 0 && value !== "Unknown"
  )
    ? publication
    : undefined;
};

const buildThread = (row: BrandwatchExportRow) => {
  const thread = {
    platform:
      asString(row["Content Source Name"]) ??
      asString(row["Page Type"]) ??
      "Unknown",
    sourceThreadId: asString(row["Thread Id"]),
    parentPostId: asString(row["Parent Post Id"]),
    rootPostId: asString(row["Root Post Id"]),
    threadUrl: asString(row["Thread URL"]),
    threadAuthor: asString(row["Thread Author"]),
    threadCreatedAt: normalizeDateValue(asString(row["Thread Created Date"])),
    entryType: asString(row["Thread Entry Type"]),
    parentBlogName: asString(row["Parent Blog Name"]),
    rootBlogName: asString(row["Root Blog Name"])
  };

  return Object.values(thread).some(
    (value) => value !== undefined && value !== "Unknown"
  )
    ? thread
    : undefined;
};

const buildGeography = (row: BrandwatchExportRow) => {
  const geography = {
    continentCode: asString(row["Continent Code"]),
    continent: asString(row.Continent),
    countryCode: asString(row["Country Code"]),
    country: asString(row.Country),
    regionCode: asString(row["Region Code"]),
    region: asString(row.Region),
    cityCode: asString(row["City Code"]),
    city: asString(row.City),
    locationName: asString(row["Location Name"]),
    latitude: asNumber(row.Latitude),
    longitude: asNumber(row.Longitude)
  };

  return Object.values(geography).some((value) => value !== undefined)
    ? geography
    : undefined;
};

const normalizeMention = (
  agencyId: string,
  metadata: BrandwatchExportMetadata,
  row: ParsedRow,
  rawObjectKey: string
) => {
  const pageType = asString(row.values["Page Type"]);
  const contentSourceName =
    asString(row.values["Content Source Name"]) ??
    asString(row.values["Unified Source Name"]) ??
    pageType ??
    "unknown";
  const title = asString(row.values.Title);
  const body =
    asString(row.values["Full Text"]) ??
    asString(row.values.Snippet) ??
    title ??
    "Contenido no disponible";
  const sentiment =
    (asString(row.values.Sentiment) as
      | "positive"
      | "neutral"
      | "negative"
      | "mixed"
      | undefined) ?? "neutral";
  const source = mapSource(pageType);
  const priorityRaw = asString(row.values.Priority)?.toLowerCase();
  const priority =
    priorityRaw === "critical" ||
    priorityRaw === "high" ||
    priorityRaw === "medium" ||
    priorityRaw === "low"
      ? priorityRaw
      : sentiment === "negative"
        ? "critical"
        : source === "news"
          ? "high"
          : "medium";
  const mentionUrl =
    asString(row.values.Url) ??
    asString(row.values["Original Url"]) ??
    `about:blank#${row.rowNumber}`;
  const hashTags = splitList(asString(row.values.Hashtags));
  const topics = [
    ...splitList(asString(row.values["Subreddit Topics"])),
    ...(pageType ? [pageType] : []),
    ...(contentSourceName ? [contentSourceName] : [])
  ].filter(Boolean);
  const keywords = [
    ...hashTags,
    ...splitList(asString(row.values["Mentioned Authors"]))
  ];

  return {
    sourceQueryExternalId: asString(row.values["Query Id"]) ?? "unknown",
    sourceQueryName: asString(row.values["Query Name"]) ?? metadata.brandName,
    metadata,
    mention: {
      id: `mention-${canonicalExternalId(row.values).replaceAll(/[^a-zA-Z0-9-_:.]/g, "_")}`,
      agencyId,
      externalId: canonicalExternalId(row.values),
      source,
      sourceSystem: "brandwatch_export",
      channel: contentSourceName,
      title,
      body,
      url: mentionUrl,
      language: asString(row.values.Language) ?? "es",
      sentiment,
      priority,
      authorName:
        asString(row.values["Full Name"]) ??
        asString(row.values.Author) ??
        asString(row.values["Thread Author"]) ??
        "Autor desconocido",
      authorHandle: asString(row.values.Author),
      topics: [...new Set(topics)],
      keywords: [...new Set(keywords)],
      occurredAt:
        normalizeDateValue(asString(row.values.Date)) ?? metadata.from,
      receivedAt:
        normalizeDateValue(asString(row.values.Updated)) ??
        normalizeDateValue(asString(row.values.Added)) ??
        metadata.to,
      isCritical: priority === "critical",
      rawObjectKey: `${rawObjectKey}#row=${row.rowNumber}`,
      engagement: {
        likes: chooseMetric(row.values, [
          "Likes",
          "X Likes",
          "Facebook Likes",
          "Instagram Likes",
          "Threads Likes",
          "Tiktok Likes",
          "Youtube Likes",
          "Bluesky Likes"
        ]),
        comments: chooseMetric(row.values, [
          "Comments",
          "X Replies",
          "Facebook Comments",
          "Instagram Comments",
          "Threads Replies",
          "Tiktok Comments",
          "Youtube Comments",
          "Reddit Comments"
        ]),
        shares: chooseMetric(row.values, [
          "Shares",
          "X Reposts",
          "Facebook Shares",
          "Threads Shares",
          "Tiktok Shares",
          "Bluesky Reposts",
          "Social Shares"
        ]),
        impressions: chooseMetric(row.values, [
          "Impressions",
          "Linkedin Impressions",
          "Threads Views",
          "Tiktok Views",
          "Resource Views"
        ])
      }
    },
    rawRow: {
      rowNumber: row.rowNumber,
      queryId: asString(row.values["Query Id"]) ?? "unknown",
      mentionId: asString(row.values["Mention Id"]),
      resourceId: asString(row.values["Resource Id"]),
      canonicalExternalId: canonicalExternalId(row.values),
      url: mentionUrl,
      pageType,
      contentSourceName,
      rawPayload: row.values
    },
    author: buildAuthor(row.values),
    publication: buildPublication(row.values),
    thread: buildThread(row.values),
    geography: buildGeography(row.values),
    metrics: toMetricEntries(row.values),
    attributes: toAttributeEntries(row.values)
  } satisfies CanonicalMentionImport;
};

const parseWorkbook = (workbook: XLSX.WorkBook) => {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook sin hojas");
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<BrandwatchExportCell[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false
  });
  const headerRowIndex = detectHeaderRowIndex(matrix);
  const dataRowStart = headerRowIndex + 1;

  const metadataMap = new Map<string, string>();
  for (let index = 0; index <= 4; index += 1) {
    const row = matrix[index];
    if (row?.[0]) {
      const key = String(row[0]).replace(":", "");
      const value = String(row[1] ?? "");
      metadataMap.set(
        key,
        key === "From" || key === "To"
          ? (normalizeDateValue(value) ?? value)
          : value
      );
    }
  }

  const headers = (matrix[headerRowIndex] ?? [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const rows = matrix.slice(dataRowStart).map((cells, index) => {
    const values = Object.fromEntries(
      headers.map((header, headerIndex) => [
        header,
        normalizeCell(cells?.[headerIndex])
      ])
    );
    return {
      rowNumber: dataRowStart + index + 1,
      values
    };
  });

  const nonEmptyRows = rows.filter((row) =>
    Object.values(row.values).some((value) => value !== null)
  );
  const metadata: BrandwatchExportMetadata = {
    reportName: metadataMap.get("Report") ?? "Bulk Mentions Download",
    brandName: metadataMap.get("Brand") ?? "",
    from: metadataMap.get("From") ?? "",
    to: metadataMap.get("To") ?? "",
    label: metadataMap.get("Label") ?? "",
    sheetName,
    rowCount: nonEmptyRows.length,
    columnCount: headers.length
  };

  return {
    metadata,
    columns: headers,
    rows: nonEmptyRows
  };
};

export const loadBrandwatchExportWorkbookFromBuffer = (
  buffer: Buffer
): BrandwatchExportWorkbook => {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const parsed = parseWorkbook(workbook);

  return {
    ...parsed,
    checksum: createHash("sha256").update(buffer).digest("hex")
  };
};

export const loadBrandwatchExportWorkbookFromFile = async (
  filePath: string
): Promise<BrandwatchExportWorkbook> => {
  const buffer = await readFile(filePath);
  return loadBrandwatchExportWorkbookFromBuffer(buffer);
};

export const buildBrandwatchDataDictionary = (
  workbook: BrandwatchExportWorkbook
): BrandwatchDataDictionaryColumn[] =>
  workbook.columns.map((column) => {
    const values = workbook.rows.map((row) => row.values[column] ?? null);
    const nonNullValues = values.filter((value) => value !== null);
    const family = inferFamily(column);
    const classification = inferClassification(column);

    return {
      name: column,
      family,
      inferredType: inferPrimitiveType(values),
      coverage:
        workbook.rows.length === 0
          ? 0
          : Number((nonNullValues.length / workbook.rows.length).toFixed(4)),
      nonNullCount: nonNullValues.length,
      uniqueCount: new Set(nonNullValues.map((value) => String(value))).size,
      classification,
      destination: inferDestination(column, classification),
      transformation: inferTransformation(column, classification),
      use: inferUse(column, classification),
      description: inferDescription(column, family, classification)
    };
  });

export const normalizeBrandwatchExportWorkbook = (
  agencyId: string,
  workbook: BrandwatchExportWorkbook,
  rawObjectKey: string,
  fileName: string
): BrandwatchWorkbookImportInput => ({
  agencyId,
  fileName,
  sheetName: workbook.metadata.sheetName,
  s3Key: rawObjectKey,
  rawObjectKey,
  checksum: workbook.checksum,
  metadata: workbook.metadata,
  items: workbook.rows.map((row) =>
    normalizeMention(agencyId, workbook.metadata, row, rawObjectKey)
  )
});
