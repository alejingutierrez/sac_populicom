import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBrandwatchDataDictionary,
  loadBrandwatchExportWorkbookFromFile
} from "@sac/brandwatch";

type Args = {
  filePath: string;
  outDir: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  let filePath = "";
  let outDir = "docs/brandwatch-export";

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current) {
      continue;
    }

    if (current === "--out-dir" && args[index + 1]) {
      outDir = args[index + 1]!;
      index += 1;
      continue;
    }

    if (!current.startsWith("--") && !filePath) {
      filePath = current;
    }
  }

  if (!filePath) {
    throw new Error(
      "Usage: pnpm brandwatch:profile <xlsx-path> [--out-dir docs/brandwatch-export]"
    );
  }

  return {
    filePath,
    outDir
  };
};

const escapeMarkdown = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll("\n", "<br />");

const toSortedCounts = (values: Array<string | undefined>) =>
  Object.entries(
    values.reduce<Record<string, number>>((accumulator, value) => {
      const key = value?.trim() || "(vacío)";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {})
  ).sort((left, right) => right[1] - left[1]);

const renderTopList = (
  title: string,
  values: Array<[string, number]>,
  limit = 12
) => {
  const lines = values
    .slice(0, limit)
    .map(([label, count]) => `- ${label}: ${count}`);
  return [`### ${title}`, ...lines, ""].join("\n");
};

const main = async () => {
  const { filePath, outDir } = parseArgs();
  const workbook = await loadBrandwatchExportWorkbookFromFile(filePath);
  const dictionary = buildBrandwatchDataDictionary(workbook);
  const rows = workbook.rows.map((row) => row.values);

  const pageTypeCounts = toSortedCounts(
    rows.map((row) =>
      typeof row["Page Type"] === "string" ? row["Page Type"] : undefined
    )
  );
  const sentimentCounts = toSortedCounts(
    rows.map((row) =>
      typeof row.Sentiment === "string" ? row.Sentiment : undefined
    )
  );
  const languageCounts = toSortedCounts(
    rows.map((row) =>
      typeof row.Language === "string" ? row.Language : undefined
    )
  );
  const countryCounts = toSortedCounts(
    rows.map((row) =>
      typeof row.Country === "string" ? row.Country : undefined
    )
  );
  const classificationCounts = toSortedCounts(
    dictionary.map((column) => column.classification)
  );
  const familyCounts = toSortedCounts(
    dictionary.map((column) => column.family)
  );
  const missingMentionIdRows = workbook.rows
    .filter((row) => !row.values["Mention Id"] && row.values["Resource Id"])
    .map((row) => ({
      rowNumber: row.rowNumber,
      resourceId: row.values["Resource Id"],
      pageType: row.values["Page Type"],
      url: row.values.Url
    }));

  const profile = {
    sourceFile: filePath,
    generatedAt: new Date().toISOString(),
    metadata: workbook.metadata,
    checksum: workbook.checksum,
    classificationCounts: Object.fromEntries(classificationCounts),
    familyCounts: Object.fromEntries(familyCounts),
    pageTypeCounts: Object.fromEntries(pageTypeCounts),
    sentimentCounts: Object.fromEntries(sentimentCounts),
    languageCounts: Object.fromEntries(languageCounts),
    countryCounts: Object.fromEntries(countryCounts),
    missingMentionIdRows
  };

  const dictionaryMarkdown = [
    "# Diccionario de datos Brandwatch",
    "",
    `Archivo fuente: \`${filePath}\``,
    `Checksum SHA-256: \`${workbook.checksum}\``,
    "",
    "## Metadatos del reporte",
    "",
    `- Report: ${workbook.metadata.reportName}`,
    `- Brand: ${workbook.metadata.brandName}`,
    `- From: ${workbook.metadata.from}`,
    `- To: ${workbook.metadata.to}`,
    `- Label: ${workbook.metadata.label}`,
    `- Sheet: ${workbook.metadata.sheetName}`,
    `- Filas de datos: ${workbook.metadata.rowCount}`,
    `- Columnas: ${workbook.metadata.columnCount}`,
    "",
    "## Resumen operativo",
    "",
    `- Filas sin \`Mention Id\` pero con fallback viable: ${missingMentionIdRows.length}`,
    `- Clasificaciones detectadas: ${classificationCounts.map(([label, count]) => `${label}=${count}`).join(", ")}`,
    `- Familias detectadas: ${familyCounts.map(([label, count]) => `${label}=${count}`).join(", ")}`,
    "",
    renderTopList("Page Types", pageTypeCounts),
    renderTopList("Sentiment", sentimentCounts),
    renderTopList("Language", languageCounts),
    renderTopList("Country", countryCounts),
    "## Tabla completa",
    "",
    "| Columna | Familia | Tipo inferido | Cobertura | No nulos | Únicos | Clasificación | Destino | Transformación | Uso | Descripción |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |",
    ...dictionary.map((column) =>
      [
        column.name,
        column.family,
        column.inferredType,
        column.coverage.toFixed(4),
        String(column.nonNullCount),
        String(column.uniqueCount),
        column.classification,
        column.destination,
        column.transformation,
        column.use,
        column.description
      ]
        .map((value) => escapeMarkdown(value))
        .join(" | ")
        .replace(/^/, "| ")
        .concat(" |")
    ),
    ""
  ].join("\n");

  const profileMarkdown = [
    "# Perfil del export Brandwatch",
    "",
    `Archivo fuente: \`${filePath}\``,
    "",
    "## Metadatos",
    "",
    "```json",
    JSON.stringify(workbook.metadata, null, 2),
    "```",
    "",
    "## Resumen de esquema",
    "",
    "```json",
    JSON.stringify(
      {
        checksum: workbook.checksum,
        classificationCounts: profile.classificationCounts,
        familyCounts: profile.familyCounts,
        pageTypeCounts: profile.pageTypeCounts,
        sentimentCounts: profile.sentimentCounts,
        languageCounts: profile.languageCounts,
        countryCounts: profile.countryCounts,
        missingMentionIdRows: profile.missingMentionIdRows.slice(0, 25)
      },
      null,
      2
    ),
    "```",
    ""
  ].join("\n");

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "profile.json"),
    JSON.stringify(profile, null, 2)
  );
  await writeFile(path.join(outDir, "profile.md"), profileMarkdown);
  await writeFile(
    path.join(outDir, "data-dictionary.json"),
    JSON.stringify(dictionary, null, 2)
  );
  await writeFile(path.join(outDir, "data-dictionary.md"), dictionaryMarkdown);

  console.log(
    JSON.stringify(
      {
        outDir,
        files: [
          "profile.json",
          "profile.md",
          "data-dictionary.json",
          "data-dictionary.md"
        ],
        rowCount: workbook.metadata.rowCount,
        columnCount: workbook.metadata.columnCount
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
