import { describe, expect, it } from "vitest";

import { toExplorationFilters, toMentionFilters } from "./server";

describe("web filter parsing", () => {
  it("maps search params into mention filters", async () => {
    const filters = await toMentionFilters({
      agencyId: "pr-central",
      source: "social",
      q: "crisis"
    });

    expect(filters.agencyId).toBe("pr-central");
    expect(filters.source).toBe("social");
    expect(filters.q).toBe("crisis");
  });

  it("maps search params into exploration filters", async () => {
    const filters = await toExplorationFilters({
      agencyId: "pr-central",
      batchId: "batch-1",
      sourceQueryId: "2057252986",
      sourceClass: "social",
      platformFamily: "X",
      language: "es",
      country: "Puerto Rico"
    });

    expect(filters.agencyId).toBe("pr-central");
    expect(filters.batchId).toBe("batch-1");
    expect(filters.sourceQueryId).toBe("2057252986");
    expect(filters.sourceClass).toBe("social");
    expect(filters.platformFamily).toBe("X");
    expect(filters.language).toBe("es");
    expect(filters.country).toBe("Puerto Rico");
  });
});
