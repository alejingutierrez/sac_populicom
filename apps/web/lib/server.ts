import { getDemoSession } from "@sac/auth";
import { getPublicConfig } from "@sac/config";
import { getRepository, type AlertStatus, type CasePriority, type CaseStatus, type MentionFilters } from "@sac/db";
import { headers } from "next/headers";

type SearchParamInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

const pickFirst = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export const resolveSearchParams = async (searchParams?: SearchParamInput) => {
  if (!searchParams) {
    return {};
  }

  return await searchParams;
};

export const toMentionFilters = async (searchParams?: SearchParamInput): Promise<MentionFilters> => {
  const resolved = await resolveSearchParams(searchParams);

  return {
    agencyId: pickFirst(resolved.agencyId),
    source: pickFirst(resolved.source) as MentionFilters["source"],
    sentiment: pickFirst(resolved.sentiment) as MentionFilters["sentiment"],
    priority: pickFirst(resolved.priority) as MentionFilters["priority"],
    q: pickFirst(resolved.q),
    from: pickFirst(resolved.from),
    to: pickFirst(resolved.to)
  };
};

export const getServerRuntime = async () => {
  const requestHeaders = await headers();

  return {
    config: getPublicConfig(),
    repository: getRepository(),
    session: getDemoSession(requestHeaders)
  };
};

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico"
  }).format(new Date(value));

export const toneFromStatus = (value: AlertStatus | CaseStatus | CasePriority) => {
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
