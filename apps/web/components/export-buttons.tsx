"use client";

import { startTransition, useState } from "react";

type ExportButtonsProps = {
  filters: Record<string, string | undefined>;
};

export const ExportButtons = ({ filters }: ExportButtonsProps) => {
  const [busyFormat, setBusyFormat] = useState<"" | "csv" | "pdf">("");

  const download = async (format: "csv" | "pdf") => {
    setBusyFormat(format);
    const response = await fetch("/api/reports/export", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        format,
        filters
      })
    });

    if (!response.ok) {
      setBusyFormat("");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = response.headers.get("content-disposition")?.split("filename=")[1]?.replaceAll('"', "") ?? `reporte.${format}`;

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    startTransition(() => {
      setBusyFormat("");
    });
  };

  return (
    <div className="toolbar-stack">
      <button className="button button--primary" disabled={busyFormat !== ""} onClick={() => download("csv")} type="button">
        {busyFormat === "csv" ? "Exportando..." : "Exportar CSV"}
      </button>
      <button className="button button--ghost" disabled={busyFormat !== ""} onClick={() => download("pdf")} type="button">
        {busyFormat === "pdf" ? "Exportando..." : "Exportar PDF"}
      </button>
    </div>
  );
};
