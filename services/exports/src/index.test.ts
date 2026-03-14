import { describe, expect, it } from "vitest";

import { createSeedData } from "@sac/db";

import { buildMentionReport } from "./index";

describe("exports", () => {
  it("builds csv reports", async () => {
    const report = await buildMentionReport(createSeedData().mentions, "csv");

    expect(report.contentType).toBe("text/csv");
    expect(report.content.toString("utf8")).toContain("agencyId,source,channel");
  });

  it("builds pdf reports", async () => {
    const report = await buildMentionReport(createSeedData().mentions, "pdf");

    expect(report.contentType).toBe("application/pdf");
    expect(report.content.length).toBeGreaterThan(100);
  });
});
