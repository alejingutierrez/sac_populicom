import { describe, expect, it } from "vitest";

import { createSeedData } from "@sac/db";

import { buildMentionReport } from "./index";

describe("exports", () => {
  it("builds csv reports", async () => {
    const report = await buildMentionReport(createSeedData().mentions, "csv");

    expect(report.contentType).toBe("text/csv");
    expect(report.content.toString("utf8")).toContain(
      "agencyId,source,channel"
    );
  });

  it("builds pdf reports", async () => {
    const report = await buildMentionReport(createSeedData().mentions, "pdf");

    expect(report.contentType).toBe("application/pdf");
    expect(report.content.length).toBeGreaterThan(100);
  });

  it("builds pdf reports with unsupported unicode safely", async () => {
    const seed = createSeedData();
    seed.mentions[0] = {
      ...seed.mentions[0]!,
      title: "Alerta con simbolo raro 퐆 y emoji 🚨"
    };

    const report = await buildMentionReport(seed.mentions, "pdf");

    expect(report.contentType).toBe("application/pdf");
    expect(report.content.length).toBeGreaterThan(100);
  });
});
