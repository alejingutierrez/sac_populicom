import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  buildBrandwatchDataDictionary,
  loadBrandwatchExportWorkbookFromBuffer,
  normalizeBrandwatchExportWorkbook
} from "./export";

const buildWorkbookBuffer = () => {
  const rows: Array<Array<string | number | null>> = [
    ["Report:", "Bulk Mentions Download"],
    ["Brand:", "AAA - General"],
    ["From:", "2026-03-01T00:00:00.000Z"],
    ["To:", "2026-03-13T23:59:59.000Z"],
    ["Label:", "General"],
    ["Separator", ""],
    [
      "Query Id",
      "Query Name",
      "Date",
      "Mention Id",
      "Resource Id",
      "Url",
      "Original Url",
      "Page Type",
      "Content Source Name",
      "Unified Source Name",
      "Language",
      "Sentiment",
      "Title",
      "Snippet",
      "Full Text",
      "Author",
      "Full Name",
      "Updated",
      "Added",
      "Likes",
      "Comments",
      "Shares",
      "Impressions",
      "X Author ID",
      "X Followers",
      "Hashtags",
      "Checked",
      "X Verified"
    ],
    [
      "2057252986",
      "AAA - General",
      "2026-03-13T20:00:00.000Z",
      null,
      "resource-reddit-001",
      "https://reddit.com/r/puertorico/comments/example",
      "https://reddit.com/r/puertorico/comments/example",
      "reddit",
      "reddit",
      "reddit",
      "es",
      "negative",
      "Fallo operativo en servicio",
      "Reporte ciudadano",
      "Texto completo del incidente",
      "@observador",
      "Observador PR",
      "2026-03-13T20:10:00.000Z",
      "2026-03-13T20:11:00.000Z",
      14,
      6,
      2,
      950,
      "x-author-001",
      1200,
      "#aaa, #crisis",
      "true",
      "blue"
    ]
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet0");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
};

describe("brandwatch export workbook", () => {
  it("parses metadata, headers and rows from the XLSX structure", () => {
    const workbook = loadBrandwatchExportWorkbookFromBuffer(
      buildWorkbookBuffer()
    );

    expect(workbook.metadata.reportName).toBe("Bulk Mentions Download");
    expect(workbook.metadata.brandName).toBe("AAA - General");
    expect(workbook.metadata.sheetName).toBe("Sheet0");
    expect(workbook.metadata.rowCount).toBe(1);
    expect(workbook.metadata.columnCount).toBe(28);
  });

  it("builds a data dictionary and classifies identifiers, metrics and flags", () => {
    const workbook = loadBrandwatchExportWorkbookFromBuffer(
      buildWorkbookBuffer()
    );
    const dictionary = buildBrandwatchDataDictionary(workbook);

    expect(
      dictionary.find((column) => column.name === "Mention Id")?.classification
    ).toBe("identifier");
    expect(
      dictionary.find((column) => column.name === "Likes")?.classification
    ).toBe("metric");
    expect(
      dictionary.find((column) => column.name === "Checked")?.classification
    ).toBe("flag");
  });

  it("normalizes workbook rows using the canonical fallback key order", () => {
    const workbook = loadBrandwatchExportWorkbookFromBuffer(
      buildWorkbookBuffer()
    );
    const normalized = normalizeBrandwatchExportWorkbook(
      "pr-central",
      workbook,
      "s3://sac-populicom-raw/imports/brandwatch/pr-central/2026/03/13/sample.xlsx",
      "sample.xlsx"
    );
    const item = normalized.items[0];

    expect(item?.mention.externalId).toBe("resource-reddit-001");
    expect(item?.mention.sourceSystem).toBe("brandwatch_export");
    expect(item?.mention.source).toBe("social");
    expect(item?.mention.channel).toBe("reddit");
    expect(item?.mention.priority).toBe("critical");
    expect(item?.rawRow.canonicalExternalId).toBe("resource-reddit-001");
    expect(
      item?.metrics.some(
        (metric) => metric.metricName === "Likes" && metric.metricValue === 14
      )
    ).toBe(true);
    expect(
      item?.attributes.some(
        (attribute) => attribute.attributeName === "X Verified"
      )
    ).toBe(true);
  });
});
