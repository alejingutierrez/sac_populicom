import { getDemoSession } from "@sac/auth";
import { describe, expect, it } from "vitest";

import { createMemoryRepository, createSeedData, type NormalizedMention } from "./index";

describe("memory repository integration", () => {
  it("deduplicates mentions during upsert", () => {
    const repository = createMemoryRepository(createSeedData());
    const session = getDemoSession();
    const existingMention = repository.listMentions(session)[0];
    if (!existingMention) {
      throw new Error("Expected seeded mention");
    }

    const result = repository.upsertMentions(
      [existingMention],
      {
        agencyId: existingMention.agencyId,
        fetchedCount: 1,
        sourceWindow: "window-1",
        startedAt: existingMention.receivedAt,
        finishedAt: existingMention.receivedAt
      }
    );

    expect(result.insertedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });

  it("creates alerts for critical mentions", () => {
    const repository = createMemoryRepository(createSeedData());
    const mention: NormalizedMention = {
      id: "mention-new",
      agencyId: "pr-central",
      externalId: "bw-social-9999",
      source: "social",
      channel: "X",
      title: "Nuevo incidente crítico",
      body: "Se reporta crisis y fallo de infraestructura en la capital.",
      url: "https://social.example/pr/9999",
      language: "es",
      sentiment: "negative",
      priority: "critical",
      authorName: "Observador PR",
      topics: ["infraestructura"],
      keywords: ["crisis"],
      occurredAt: "2026-03-13T22:00:00.000Z",
      receivedAt: "2026-03-13T22:02:00.000Z",
      isCritical: true,
      engagement: { likes: 10, comments: 5, shares: 2, impressions: 500 }
    };

    const result = repository.upsertMentions(
      [mention],
      {
        agencyId: mention.agencyId,
        fetchedCount: 1,
        sourceWindow: "window-2",
        startedAt: mention.receivedAt,
        finishedAt: mention.receivedAt
      }
    );

    expect(result.insertedCount).toBe(1);
    expect(result.createdAlerts).toHaveLength(1);
    expect(repository.state.alerts[0]?.mentionId).toBe("mention-new");
  });
});
