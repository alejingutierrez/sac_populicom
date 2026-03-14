import { getDemoSession } from "@sac/auth";
import { getPublicConfig } from "@sac/config";
import {
  getRepository,
  type ExplorationFilters,
  type ExplorationMeta,
  type MentionFilters
} from "@sac/db";
import { headers } from "next/headers";

export { formatDateTime, toneFromStatus } from "./format";

type SearchParamInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

const pickFirst = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const fromSearchParamRecord = (
  searchParams: URLSearchParams
): Record<string, string> => Object.fromEntries(searchParams.entries());

export const resolveSearchParams = async (searchParams?: SearchParamInput) => {
  if (!searchParams) {
    return {};
  }

  return await searchParams;
};

export const toMentionFilters = async (
  searchParams?: SearchParamInput
): Promise<MentionFilters> => {
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

export const toExplorationFilters = async (
  searchParams?: SearchParamInput
): Promise<ExplorationFilters> => {
  const resolved = await resolveSearchParams(searchParams);

  return {
    agencyId: pickFirst(resolved.agencyId),
    batchId: pickFirst(resolved.batchId),
    sourceQueryId: pickFirst(resolved.sourceQueryId),
    source: pickFirst(resolved.source) as ExplorationFilters["source"],
    sourceClass: pickFirst(resolved.sourceClass),
    platformFamily: pickFirst(resolved.platformFamily),
    sentiment: pickFirst(resolved.sentiment) as ExplorationFilters["sentiment"],
    language: pickFirst(resolved.language),
    country: pickFirst(resolved.country),
    priority: pickFirst(resolved.priority) as ExplorationFilters["priority"],
    q: pickFirst(resolved.q),
    from: pickFirst(resolved.from),
    to: pickFirst(resolved.to)
  };
};

export const parseExplorationFiltersFromUrl = (searchParams: URLSearchParams) =>
  toExplorationFilters(fromSearchParamRecord(searchParams));

export const getServerRuntime = async () => {
  const requestHeaders = await headers();
  const repository = getRepository();
  await repository.ready();

  return {
    config: getPublicConfig(),
    repository,
    session: getDemoSession(requestHeaders)
  };
};

export const resolveExplorationContext = async (
  searchParams?: SearchParamInput
): Promise<{
  filters: ExplorationFilters;
  meta: ExplorationMeta;
}> => {
  const { repository, session } = await getServerRuntime();
  const requested = await toExplorationFilters(searchParams);
  const meta = await repository.getExplorationMeta(session, {
    agencyId: requested.agencyId ?? session.activeAgencyId
  });
  const effectiveAgencyId = requested.agencyId ?? meta.defaults.agencyId;
  const effectiveBatchId =
    requested.batchId && requested.batchId !== "latest"
      ? requested.batchId
      : meta.defaults.batchId;
  const selectedBatch = meta.batches.find(
    (batch) => batch.id === effectiveBatchId
  );

  return {
    meta,
    filters: {
      ...requested,
      agencyId: effectiveAgencyId,
      batchId: effectiveBatchId,
      from: requested.from ?? selectedBatch?.from ?? meta.defaults.from,
      to: requested.to ?? selectedBatch?.to ?? meta.defaults.to
    }
  };
};
