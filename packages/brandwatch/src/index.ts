import type { MentionSentiment, MentionSource, NormalizedMention } from "@sac/db";

export type BrandwatchMentionPayload = {
  id: string;
  source: MentionSource;
  channel: string;
  headline?: string;
  body: string;
  url: string;
  language?: string;
  sentiment?: "positive" | "neutral" | "negative" | "mixed" | "unknown";
  authorName: string;
  authorHandle?: string;
  publishedAt: string;
  topics?: string[];
  keywords?: string[];
  metrics?: Partial<NormalizedMention["engagement"]>;
  critical?: boolean;
};

export type BrandwatchFetchParams = {
  agencyId: string;
  from: string;
  to: string;
  cursor?: string;
  sources?: MentionSource[];
};

export type BrandwatchFetchResult = {
  cursor?: string;
  items: BrandwatchMentionPayload[];
};

export type BrandwatchClient = {
  fetchMentions(params: BrandwatchFetchParams): Promise<BrandwatchFetchResult>;
};

const normalizeSentiment = (sentiment: BrandwatchMentionPayload["sentiment"]): MentionSentiment => {
  if (!sentiment || sentiment === "unknown") {
    return "neutral";
  }

  return sentiment;
};

export const normalizeBrandwatchMention = (
  agencyId: string,
  payload: BrandwatchMentionPayload,
  rawObjectKey?: string
): NormalizedMention => ({
  id: `mention-${payload.id}`,
  agencyId,
  externalId: payload.id,
  source: payload.source,
  channel: payload.channel,
  title: payload.headline,
  body: payload.body,
  url: payload.url,
  language: payload.language ?? "es",
  sentiment: normalizeSentiment(payload.sentiment),
  priority:
    payload.critical || normalizeSentiment(payload.sentiment) === "negative"
      ? "critical"
      : payload.source === "news"
        ? "high"
        : "medium",
  authorName: payload.authorName,
  authorHandle: payload.authorHandle,
  topics: payload.topics ?? [],
  keywords: payload.keywords ?? [],
  occurredAt: payload.publishedAt,
  receivedAt: new Date().toISOString(),
  isCritical: Boolean(payload.critical),
  rawObjectKey,
  engagement: {
    likes: payload.metrics?.likes ?? 0,
    comments: payload.metrics?.comments ?? 0,
    shares: payload.metrics?.shares ?? 0,
    impressions: payload.metrics?.impressions ?? 0
  }
});

const mockPayloads: BrandwatchMentionPayload[] = [
  {
    id: "bw-1",
    source: "social",
    channel: "X",
    headline: "Reporte comunitario",
    body: "Se reporta interrupción del servicio eléctrico en el área metropolitana.",
    url: "https://brandwatch.example/social/bw-1",
    language: "es",
    sentiment: "negative",
    authorName: "Comunidad PR",
    authorHandle: "@comunidadpr",
    publishedAt: "2026-03-13T21:00:00.000Z",
    topics: ["infraestructura"],
    keywords: ["interrupción", "servicio"],
    metrics: {
      likes: 34,
      comments: 17,
      shares: 9,
      impressions: 1400
    },
    critical: true
  },
  {
    id: "bw-2",
    source: "news",
    channel: "Noticias",
    headline: "Medios siguen situación de servicios",
    body: "La prensa local amplía el contexto de servicio ciudadano.",
    url: "https://brandwatch.example/news/bw-2",
    sentiment: "neutral",
    authorName: "Redacción",
    publishedAt: "2026-03-13T21:05:00.000Z",
    topics: ["atención ciudadana"],
    keywords: ["servicios"]
  }
];

export class MockBrandwatchClient implements BrandwatchClient {
  fetchMentions(params: BrandwatchFetchParams): Promise<BrandwatchFetchResult> {
    const filtered = mockPayloads.filter((item) => !params.sources || params.sources.includes(item.source));

    return Promise.resolve({
      cursor: params.cursor,
      items: filtered
    });
  }
}
