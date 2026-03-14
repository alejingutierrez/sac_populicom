import { describe, expect, it } from "vitest";

import { buildEnrichedMentions } from "./enrichments";
import {
  buildExplorationBreakdowns,
  buildExplorationEntities,
  buildExplorationHeatmap,
  buildExplorationMeta,
  buildExplorationSummary,
  buildExplorationTimeseries,
  filterExplorationMentions,
  resolveExplorationGranularity
} from "./exploration";
import type { CanonicalMentionImport, NormalizedMention } from "./types";

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

describe("exploration helpers", () => {
  it("builds exploration meta and defaults from enriched mentions", () => {
    const mentions = buildEnrichedMentions([
      createSeedRecord(createMention("mention-a"), {
        "Query Id": "2057252986",
        "Page Type": "twitter",
        Country: "Puerto Rico"
      }),
      createSeedRecord(
        createMention("mention-b", {
          sentiment: "negative",
          occurredAt: "2026-03-15T18:00:00.000Z",
          receivedAt: "2026-03-15T18:20:00.000Z"
        }),
        {
          "Query Id": "2057252986",
          "Page Type": "news",
          Country: "United States"
        },
        "batch-2"
      )
    ]);

    const meta = buildExplorationMeta({
      mentions,
      agencies: [
        {
          id: "pr-central",
          slug: "pr-central",
          name: "PR Central",
          isActive: true
        }
      ]
    });

    expect(meta.defaults.batchId).toBe("batch-2");
    expect(meta.platformFamilies.length).toBeGreaterThan(0);
    expect(meta.countries.map((item) => item.value)).toContain("Puerto Rico");
  });

  it("computes timeseries, heatmap, breakdowns and entities", () => {
    const mentions = buildEnrichedMentions([
      createSeedRecord(
        createMention("mention-a", {
          sentiment: "negative",
          isCritical: true,
          occurredAt: "2026-03-13T14:00:00.000Z",
          receivedAt: "2026-03-13T14:10:00.000Z"
        }),
        {
          "Query Id": "2057252986",
          "Page Type": "twitter",
          Country: "Puerto Rico"
        }
      ),
      createSeedRecord(
        createMention("mention-b", {
          url: "https://news.example.com/story-1",
          source: "news",
          channel: "News",
          occurredAt: "2026-03-13T15:00:00.000Z",
          receivedAt: "2026-03-13T15:40:00.000Z"
        }),
        {
          "Query Id": "2057252986",
          "Page Type": "news",
          Country: "United States"
        }
      )
    ]);

    const filtered = filterExplorationMentions(mentions, {
      sourceClass: "social"
    });
    const summary = buildExplorationSummary(mentions);
    const granularity = resolveExplorationGranularity(mentions, {
      from: "2026-03-13T00:00:00.000Z",
      to: "2026-03-15T00:00:00.000Z"
    });
    const timeseries = buildExplorationTimeseries(mentions, granularity);
    const heatmap = buildExplorationHeatmap(mentions);
    const breakdowns = buildExplorationBreakdowns(mentions);
    const entities = buildExplorationEntities(mentions);

    expect(filtered).toHaveLength(1);
    expect(summary.totalMentions).toBe(2);
    expect(timeseries.length).toBeGreaterThan(0);
    expect(heatmap.length).toBeGreaterThan(0);
    expect(breakdowns.latencyHistogram.length).toBeGreaterThan(0);
    expect(
      entities.topPublicationsOrDomains.some((node) =>
        node.label.includes("example")
      )
    ).toBe(true);
  });
});
