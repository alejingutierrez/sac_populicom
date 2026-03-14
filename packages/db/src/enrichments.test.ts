import { describe, expect, it } from "vitest";

import { createSeedData } from "./seed";
import {
  buildEnrichedMentions,
  buildEnrichmentRollups,
  enrichmentDefinitions,
  renderEnrichmentCatalogMarkdown,
  renderEnrichmentFormulasMarkdown
} from "./enrichments";
import type {
  CanonicalMentionImport,
  EnrichmentRollupFilters,
  NormalizedMention
} from "./types";

const createMention = (
  id: string,
  overrides: Partial<NormalizedMention> = {}
): NormalizedMention => ({
  id,
  agencyId: "pr-central",
  externalId: `${id}-external`,
  source: "social",
  sourceSystem: "brandwatch_export",
  channel: "X",
  title: `Title for ${id}`,
  body: `Body for ${id}`,
  url: `https://x.com/populicom/${id}`,
  language: "es",
  sentiment: "neutral",
  priority: "medium",
  authorName: "Autor Compartido",
  authorHandle: "@autor",
  topics: ["infraestructura"],
  keywords: ["servicio"],
  occurredAt: "2026-03-13T14:00:00.000Z",
  receivedAt: "2026-03-13T14:04:00.000Z",
  isCritical: false,
  engagement: {
    likes: 10,
    comments: 5,
    shares: 2,
    impressions: 1000
  },
  ...overrides
});

const createSeedRecord = (
  mention: NormalizedMention,
  rawPayload: CanonicalMentionImport["rawRow"]["rawPayload"],
  batchId = "batch-1",
  queryId = "2057252986"
) => ({
  mention,
  batchId,
  queryId,
  rawPayload
});

describe("enrichments", () => {
  it("exposes the 100 enrichment definitions and renders docs", () => {
    expect(enrichmentDefinitions).toHaveLength(100);
    expect(renderEnrichmentCatalogMarkdown()).toContain(
      "Total de derivadas: `100`"
    );
    expect(renderEnrichmentFormulasMarkdown()).toContain(
      "| D100 | semantic_complexity_bucket |"
    );
  });

  it("computes key per-mention enrichments and aggregate volumes", () => {
    const first = createMention("mention-a", {
      sentiment: "negative",
      priority: "critical"
    });
    const second = createMention("mention-b", {
      externalId: "mention-b-external",
      url: "https://x.com/populicom/mention-b",
      occurredAt: "2026-03-13T14:20:00.000Z",
      receivedAt: "2026-03-13T14:25:00.000Z",
      engagement: {
        likes: 8,
        comments: 6,
        shares: 3,
        impressions: 900
      }
    });
    const third = createMention("mention-c", {
      authorName: "Otra Autora",
      authorHandle: "@otra",
      url: "https://reddit.com/r/puertorico/comments/abc123",
      channel: "Reddit",
      occurredAt: "2026-03-13T18:10:00.000Z",
      receivedAt: "2026-03-13T18:25:00.000Z",
      engagement: {
        likes: 3,
        comments: 1,
        shares: 0,
        impressions: 200
      }
    });

    const enriched = buildEnrichedMentions([
      createSeedRecord(first, {
        "Query Id": "2057252986",
        "Page Type": "twitter",
        "Content Source Name": "X",
        "Resource Id": "resource-a",
        "Thread Id": "thread-1",
        Emotion: "anger",
        Reportable: "true",
        "Reach (new)": "500",
        Impact: "20",
        "Engagement Score": "50",
        Country: "Puerto Rico",
        Title: "Title for mention-a",
        Hashtags: "#uno,#dos"
      }),
      createSeedRecord(second, {
        "Query Id": "2057252986",
        "Mention Id": "mention-id-b",
        "Page Type": "twitter",
        "Content Source Name": "X",
        "Thread Id": "thread-1",
        "Reach (new)": "400",
        Impact: "10",
        "Engagement Score": "40",
        Country: "Puerto Rico",
        Title: "Title for mention-b"
      }),
      createSeedRecord(third, {
        "Query Id": "2057252987",
        "Page Type": "reddit",
        "Content Source Name": "Reddit",
        Url: "https://reddit.com/r/puertorico/comments/abc123",
        Country: "United States"
      })
    ]);

    const firstMention = enriched.find((item) => item.id === "mention-a");
    const thirdMention = enriched.find((item) => item.id === "mention-c");

    expect(firstMention).toBeDefined();
    expect(firstMention?.enrichments.canonical_external_key).toBe("resource-a");
    expect(firstMention?.enrichments.external_key_source).toBe("resource_id");
    expect(firstMention?.enrichments.platform_family).toBe("X");
    expect(firstMention?.enrichments.capture_latency_minutes).toBe(4);
    expect(firstMention?.enrichments.risk_base_score).toBe(4);
    expect(firstMention?.enrichments.earned_attention_index).toBe(0.1788);
    expect(firstMention?.enrichments.same_author_day_volume).toBe(2);
    expect(firstMention?.enrichments.same_domain_day_volume).toBe(2);
    expect(firstMention?.enrichments.same_query_platform_hour_volume).toBe(2);
    expect(firstMention?.enrichments.thread_engagement_share).toBe(0.5);
    expect(firstMention?.enrichmentMeta?.windowKeys.batch).toBe("batch-1");
    expect(firstMention?.enrichmentMeta?.queryId).toBe("2057252986");

    expect(thirdMention?.enrichments.canonical_external_key).toBe(
      "https://reddit.com/r/puertorico/comments/abc123"
    );
    expect(thirdMention?.enrichments.external_key_source).toBe("url");
    expect(thirdMention?.enrichments.platform_family).toBe("Reddit");
  });

  it("builds batch rollups from enriched mentions", () => {
    const base = createMention("mention-rollup", {
      sentiment: "negative",
      isCritical: true
    });
    const positive = createMention("mention-rollup-positive", {
      sentiment: "positive",
      url: "https://news.example/pr/1",
      source: "news",
      channel: "Noticias",
      authorName: "Redaccion"
    });

    const records = buildEnrichedMentions([
      createSeedRecord(base, {
        "Query Id": "2057252986",
        "Page Type": "twitter",
        "Content Source Name": "X",
        "Mention Id": "rollup-a",
        "Reach (new)": "800",
        Impact: "25",
        "Engagement Score": "60",
        Country: "Puerto Rico"
      }),
      createSeedRecord(positive, {
        "Query Id": "2057252986",
        "Page Type": "news",
        "Content Source Name": "News",
        "Mention Id": "rollup-b",
        "Reach (new)": "400",
        Impact: "10",
        "Engagement Score": "20",
        Country: "Puerto Rico"
      })
    ]);

    const filters: EnrichmentRollupFilters = {
      window: "batch",
      groupBy: "platform_family",
      batchId: "batch-1"
    };
    const rollups = buildEnrichmentRollups(records, filters);
    const xRollup = rollups.find((rollup) => rollup.groupKey === "X");
    const newsRollup = rollups.find((rollup) => rollup.groupKey === "News");

    expect(xRollup?.values.mention_count).toBe(1);
    expect(xRollup?.values.negative_count).toBe(1);
    expect(xRollup?.values.critical_count).toBe(1);
    expect(newsRollup?.values.positive_count).toBe(1);
  });

  it("supports the memory repository contract for a full-scope mention lookup", async () => {
    const seed = createSeedData();
    seed.mentions = [
      createMention("memory-a"),
      createMention("memory-b", {
        externalId: "memory-b-external",
        url: "https://x.com/populicom/memory-b",
        occurredAt: "2026-03-13T14:30:00.000Z"
      })
    ];

    const { createMemoryRepository } = await import("./memory");
    const repository = createMemoryRepository(seed);
    const session = (await import("@sac/auth")).getDemoSession();
    const mention = await repository.getMentionEnrichments(session, "memory-a");

    expect(await repository.listEnrichmentDefinitions()).toHaveLength(100);
    expect(mention.enrichments.same_author_day_volume).toBe(2);
    expect(mention.enrichments.same_domain_day_volume).toBe(2);
  });
});
