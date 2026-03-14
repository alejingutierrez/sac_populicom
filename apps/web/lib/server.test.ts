import { describe, expect, it } from "vitest";

import { toMentionFilters } from "./server";

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
});
