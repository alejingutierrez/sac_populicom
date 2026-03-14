import { describe, expect, it } from "vitest";

import { getRepository } from "@sac/db";

import { syncBrandwatchWindow } from "./index";

describe("ingestion", () => {
  it("ingests mock Brandwatch mentions into the repository", async () => {
    const repository = getRepository();
    await repository.ready();
    const beforeCount = repository.state?.mentions.length ?? 0;

    const result = await syncBrandwatchWindow({
      agencyId: "pr-central",
      from: "2026-03-13T21:00:00.000Z",
      to: "2026-03-13T21:05:00.000Z"
    });

    expect(result.insertedCount).toBeGreaterThanOrEqual(1);
    expect(repository.state?.mentions.length ?? 0).toBeGreaterThan(beforeCount);
  });
});
