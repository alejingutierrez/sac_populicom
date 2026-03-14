import type { AlertStatus, CasePriority, CaseStatus } from "@sac/db";

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico"
  }).format(new Date(value));

export const toneFromStatus = (
  value: AlertStatus | CaseStatus | CasePriority
) => {
  if (value === "critical" || value === "open" || value === "new") {
    return "critical" as const;
  }

  if (value === "high" || value === "triaged" || value === "acknowledged") {
    return "warning" as const;
  }

  if (value === "resolved" || value === "closed") {
    return "positive" as const;
  }

  return "info" as const;
};
