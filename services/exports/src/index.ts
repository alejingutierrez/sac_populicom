import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { NormalizedMention } from "@sac/db";

export type ExportFormat = "csv" | "pdf";

export type ExportArtifact = {
  content: Buffer;
  contentType: string;
  fileName: string;
};

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`;
const sanitizePdfText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export const buildMentionReport = async (
  mentions: NormalizedMention[],
  format: ExportFormat
): Promise<ExportArtifact> => {
  if (format === "csv") {
    const headers = [
      "agencyId",
      "source",
      "channel",
      "sentiment",
      "priority",
      "title",
      "body",
      "occurredAt"
    ];
    const rows = mentions.map((mention) =>
      [
        mention.agencyId,
        mention.source,
        mention.channel,
        mention.sentiment,
        mention.priority,
        mention.title ?? "",
        mention.body,
        mention.occurredAt
      ]
        .map(csvEscape)
        .join(",")
    );

    return {
      content: Buffer.from([headers.join(","), ...rows].join("\n"), "utf8"),
      contentType: "text/csv",
      fileName: "reporte-menciones.csv"
    };
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawText("Reporte operativo de menciones", {
    x: 48,
    y: 548,
    size: 20,
    font,
    color: rgb(0.06, 0.12, 0.25)
  });

  mentions.slice(0, 8).forEach((mention, index) => {
    const line = sanitizePdfText(
      `${index + 1}. [${mention.source}] ${mention.title ?? mention.body.slice(0, 72)} (${mention.sentiment} / ${mention.priority})`
    );
    page.drawText(line, {
      x: 48,
      y: 504 - index * 48,
      size: 11,
      font,
      color: rgb(0.12, 0.16, 0.24),
      maxWidth: 740
    });
  });

  return {
    content: Buffer.from(await pdf.save()),
    contentType: "application/pdf",
    fileName: "reporte-menciones.pdf"
  };
};
