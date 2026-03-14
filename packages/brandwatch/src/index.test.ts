import { describe, expect, it } from "vitest";

import { normalizeBrandwatchMention } from "./index";

describe("brandwatch normalization", () => {
  it("maps payloads into normalized mentions", () => {
    const mention = normalizeBrandwatchMention("pr-central", {
      id: "bw-10",
      source: "social",
      channel: "X",
      body: "Reporte crítico sobre una incidencia",
      url: "https://social.example/bw-10",
      sentiment: "negative",
      authorName: "Observatorio PR",
      publishedAt: "2026-03-13T20:00:00.000Z",
      critical: true,
      metrics: {
        likes: 10
      }
    });

    expect(mention.agencyId).toBe("pr-central");
    expect(mention.priority).toBe("critical");
    expect(mention.sentiment).toBe("negative");
    expect(mention.engagement.likes).toBe(10);
  });
});
