import {
  canAcknowledgeAlerts,
  canManageCases,
  canViewAgency,
  requireAgencyAccess,
  type SessionContext
} from "@sac/auth";

import {
  assertCaseTransition,
  createAlertFromMention,
  createId,
  createSeedData,
  now
} from "./seed";
import {
  buildEnrichedMentions,
  buildEnrichmentRollups,
  enrichmentDefinitions
} from "./enrichments";
import {
  buildExplorationBreakdowns,
  buildExplorationEntities,
  buildExplorationHeatmap,
  buildExplorationMentionRows,
  buildExplorationMeta,
  buildExplorationScatter,
  buildExplorationSummary,
  buildExplorationTimeseries,
  filterExplorationMentions,
  resolveExplorationGranularity
} from "./exploration";
import type {
  Alert,
  BrandwatchSyncRun,
  BrandwatchWorkbookImportInput,
  Case,
  CaseEvent,
  CreateCaseInput,
  DashboardSummary,
  EnrichedMention,
  EnrichmentDefinition,
  EnrichmentListOptions,
  EnrichmentRollup,
  EnrichmentRollupFilters,
  ExplorationFilters,
  ExplorationMentionListOptions,
  ImportResult,
  MentionFilters,
  NormalizedMention,
  Repository,
  RepositorySeed,
  SavedFilter,
  UpdateCaseInput
} from "./types";

const matchesMentionFilters = (
  mention: NormalizedMention,
  filters: MentionFilters
) => {
  if (filters.agencyId && mention.agencyId !== filters.agencyId) {
    return false;
  }

  if (filters.source && mention.source !== filters.source) {
    return false;
  }

  if (filters.sentiment && mention.sentiment !== filters.sentiment) {
    return false;
  }

  if (filters.priority && mention.priority !== filters.priority) {
    return false;
  }

  if (filters.q) {
    const haystack =
      `${mention.title ?? ""} ${mention.body} ${mention.keywords.join(" ")} ${mention.topics.join(" ")}`.toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) {
      return false;
    }
  }

  if (filters.from && mention.occurredAt < filters.from) {
    return false;
  }

  if (filters.to && mention.occurredAt > filters.to) {
    return false;
  }

  return true;
};

export type MemoryRepository = ReturnType<typeof createMemoryRepository>;

export const createMemoryRepository = (
  seed: RepositorySeed = createSeedData()
) => {
  const state = structuredClone(seed);
  const importContextByMentionId = new Map<
    string,
    {
      batchId?: string;
      queryId?: string;
      rawPayload?: BrandwatchWorkbookImportInput["items"][number]["rawRow"]["rawPayload"];
    }
  >();

  const visibleAgencyIds = (session: SessionContext) =>
    session.role === "admin"
      ? state.agencies.map((agency) => agency.id)
      : session.agencyIds;

  const findScopedMention = (session: SessionContext, mentionId: string) => {
    const mention = state.mentions.find((item) => item.id === mentionId);
    if (!mention) {
      throw new Error(`Mention ${mentionId} not found`);
    }

    requireAgencyAccess(session, mention.agencyId);
    return mention;
  };

  const listMentions = (
    session: SessionContext,
    filters: MentionFilters = {}
  ) =>
    state.mentions
      .filter((mention) => visibleAgencyIds(session).includes(mention.agencyId))
      .filter((mention) => matchesMentionFilters(mention, filters))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  const listEnrichmentDefinitions = (): EnrichmentDefinition[] =>
    enrichmentDefinitions;

  const buildScopedEnrichedMentions = (
    session: SessionContext,
    filters: MentionFilters = {},
    options: EnrichmentListOptions = {}
  ): EnrichedMention[] => {
    const records = buildEnrichedMentions(
      listMentions(session, filters).map((mention) => ({
        mention,
        batchId: importContextByMentionId.get(mention.id)?.batchId,
        queryId: importContextByMentionId.get(mention.id)?.queryId,
        rawPayload: importContextByMentionId.get(mention.id)?.rawPayload
      })),
      options.includeDisabled
    );
    const offset = options.offset ?? 0;
    const limit =
      typeof options.limit === "number"
        ? Math.max(options.limit, 0)
        : undefined;

    return typeof limit === "number"
      ? records.slice(offset, offset + limit)
      : records.slice(offset);
  };

  const listMentionsEnriched = (
    session: SessionContext,
    filters: MentionFilters = {},
    options: EnrichmentListOptions = {}
  ): EnrichedMention[] =>
    buildScopedEnrichedMentions(session, filters, options);

  const getMentionEnrichments = (
    session: SessionContext,
    mentionId: string,
    options: Pick<EnrichmentListOptions, "includeDisabled"> = {}
  ): EnrichedMention => {
    findScopedMention(session, mentionId);
    const enriched = buildScopedEnrichedMentions(session, {}, options).find(
      (record) => record.id === mentionId
    );

    if (!enriched) {
      throw new Error(`Mention ${mentionId} not found`);
    }

    return enriched;
  };

  const listEnrichmentRollups = (
    session: SessionContext,
    filters: EnrichmentRollupFilters
  ): EnrichmentRollup[] =>
    buildEnrichmentRollups(
      buildScopedEnrichedMentions(
        session,
        {
          agencyId: filters.agencyId
        },
        {
          includeDisabled: filters.includeDisabled
        }
      ),
      filters
    );

  const buildScopedExplorationMentions = (
    session: SessionContext,
    filters: ExplorationFilters = {}
  ) =>
    filterExplorationMentions(
      buildScopedEnrichedMentions(
        session,
        {
          agencyId: filters.agencyId,
          source: filters.source,
          sentiment: filters.sentiment,
          priority: filters.priority,
          q: filters.q,
          from: filters.from,
          to: filters.to
        },
        {
          includeDisabled: false
        }
      ),
      filters
    );

  const getExplorationMeta: Repository["getExplorationMeta"] = (
    session,
    filters = {}
  ) =>
    buildExplorationMeta(
      {
        mentions: buildScopedEnrichedMentions(
          session,
          {
            agencyId: filters.agencyId
          },
          {
            includeDisabled: false
          }
        ),
        agencies: state.agencies.filter((agency) =>
          visibleAgencyIds(session).includes(agency.id)
        )
      },
      filters
    );

  const getExplorationSummary: Repository["getExplorationSummary"] = (
    session,
    filters = {}
  ) =>
    buildExplorationSummary(
      buildScopedExplorationMentions(session, filters),
      filters
    );

  const getExplorationTimeseries: Repository["getExplorationTimeseries"] = (
    session,
    filters = {},
    granularity
  ) => {
    const mentions = buildScopedExplorationMentions(session, filters);
    return buildExplorationTimeseries(
      mentions,
      granularity ?? resolveExplorationGranularity(mentions, filters)
    );
  };

  const getExplorationHeatmap: Repository["getExplorationHeatmap"] = (
    session,
    filters = {}
  ) =>
    buildExplorationHeatmap(buildScopedExplorationMentions(session, filters));

  const getExplorationBreakdowns: Repository["getExplorationBreakdowns"] = (
    session,
    filters = {}
  ) =>
    buildExplorationBreakdowns(
      buildScopedExplorationMentions(session, filters)
    );

  const getExplorationScatter: Repository["getExplorationScatter"] = (
    session,
    filters = {}
  ) =>
    buildExplorationScatter(buildScopedExplorationMentions(session, filters));

  const getExplorationEntities: Repository["getExplorationEntities"] = (
    session,
    filters = {}
  ) =>
    buildExplorationEntities(buildScopedExplorationMentions(session, filters));

  const listExplorationMentions: Repository["listExplorationMentions"] = (
    session,
    filters = {},
    options: ExplorationMentionListOptions = {}
  ) =>
    buildExplorationMentionRows(
      buildScopedExplorationMentions(session, filters),
      options
    );

  const listAlerts = (session: SessionContext, agencyId?: string) =>
    state.alerts
      .filter((alert) => visibleAgencyIds(session).includes(alert.agencyId))
      .filter((alert) => !agencyId || alert.agencyId === agencyId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const listCases = (session: SessionContext, agencyId?: string) =>
    state.cases
      .filter((record) => visibleAgencyIds(session).includes(record.agencyId))
      .filter((record) => !agencyId || record.agencyId === agencyId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const getDashboardSummary = (session: SessionContext): DashboardSummary => {
    const scopedMentions = listMentions(session);
    const scopedAlerts = listAlerts(session);
    const scopedCases = listCases(session);

    return {
      mentionsLast24h: scopedMentions.length,
      openAlerts: scopedAlerts.filter((alert) => alert.status === "open")
        .length,
      openCases: scopedCases.filter((record) => record.status !== "closed")
        .length,
      criticalMentions: scopedMentions.filter((mention) => mention.isCritical)
        .length,
      agenciesCovered: visibleAgencyIds(session).length
    };
  };

  const createCase = (
    session: SessionContext,
    input: CreateCaseInput
  ): Case => {
    if (!canManageCases(session, input.agencyId)) {
      throw new Error(
        `Role ${session.role} cannot create cases for ${input.agencyId}`
      );
    }

    const timestamp = now();

    if (input.mentionId) {
      findScopedMention(session, input.mentionId);
    }

    const nextCase: Case = {
      id: createId("case"),
      agencyId: input.agencyId,
      mentionId: input.mentionId,
      alertId: input.alertId,
      title: input.title,
      summary: input.summary,
      status: "new",
      priority: input.priority,
      assignedToId: input.assignedToId,
      createdById: session.userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const event: CaseEvent = {
      id: createId("case-event"),
      caseId: nextCase.id,
      actorId: session.userId,
      type: "created",
      description: "Caso creado desde consola operativa.",
      createdAt: timestamp
    };

    state.cases.unshift(nextCase);
    state.caseEvents.unshift(event);
    state.auditLogs.unshift({
      id: createId("audit"),
      actorId: session.userId,
      agencyId: input.agencyId,
      action: "case.created",
      subjectType: "case",
      subjectId: nextCase.id,
      metadata: {
        priority: input.priority
      },
      createdAt: timestamp
    });

    return nextCase;
  };

  const updateCase = (
    session: SessionContext,
    caseId: string,
    input: UpdateCaseInput
  ): Case => {
    const record = state.cases.find((entry) => entry.id === caseId);

    if (!record) {
      throw new Error(`Case ${caseId} not found`);
    }

    if (!canManageCases(session, record.agencyId)) {
      throw new Error(
        `Role ${session.role} cannot update cases for ${record.agencyId}`
      );
    }

    const events: CaseEvent[] = [];

    if (input.status) {
      assertCaseTransition(record.status, input.status);
      record.status = input.status;
      events.push({
        id: createId("case-event"),
        caseId,
        actorId: session.userId,
        type: "status_changed",
        description: `Estado actualizado a ${input.status}.`,
        createdAt: now()
      });
    }

    if (input.priority) {
      record.priority = input.priority;
      events.push({
        id: createId("case-event"),
        caseId,
        actorId: session.userId,
        type: "priority_changed",
        description: `Prioridad actualizada a ${input.priority}.`,
        createdAt: now()
      });
    }

    if (input.assignedToId) {
      record.assignedToId = input.assignedToId;
      events.push({
        id: createId("case-event"),
        caseId,
        actorId: session.userId,
        type: "assigned",
        description: `Caso asignado a ${input.assignedToId}.`,
        createdAt: now()
      });
    }

    if (input.note) {
      events.push({
        id: createId("case-event"),
        caseId,
        actorId: session.userId,
        type: "comment",
        description: input.note,
        createdAt: now()
      });
    }

    record.updatedAt = now();
    state.caseEvents.unshift(...events);
    state.auditLogs.unshift({
      id: createId("audit"),
      actorId: session.userId,
      agencyId: record.agencyId,
      action: "case.updated",
      subjectType: "case",
      subjectId: record.id,
      metadata: {
        status: input.status ?? record.status,
        priority: input.priority ?? record.priority
      },
      createdAt: now()
    });

    return record;
  };

  const acknowledgeAlert = (
    session: SessionContext,
    alertId: string
  ): Alert => {
    const alert = state.alerts.find((entry) => entry.id === alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!canAcknowledgeAlerts(session, alert.agencyId)) {
      throw new Error(
        `Role ${session.role} cannot acknowledge alerts for ${alert.agencyId}`
      );
    }

    alert.status = "acknowledged";
    alert.updatedAt = now();

    state.auditLogs.unshift({
      id: createId("audit"),
      actorId: session.userId,
      agencyId: alert.agencyId,
      action: "alert.acknowledged",
      subjectType: "alert",
      subjectId: alert.id,
      metadata: {
        status: alert.status
      },
      createdAt: now()
    });

    return alert;
  };

  const upsertMentions = (
    mentions: NormalizedMention[],
    run: Omit<
      BrandwatchSyncRun,
      "id" | "insertedCount" | "duplicateCount" | "status"
    >
  ) => {
    let insertedCount = 0;
    let duplicateCount = 0;
    const createdAlerts: Alert[] = [];

    for (const mention of mentions) {
      const exists = state.mentions.some(
        (record) =>
          record.agencyId === mention.agencyId &&
          record.externalId === mention.externalId &&
          (record.sourceSystem ?? "brandwatch_api") ===
            (mention.sourceSystem ?? "brandwatch_api")
      );

      if (exists) {
        duplicateCount += 1;
        continue;
      }

      insertedCount += 1;
      state.mentions.unshift(mention);

      if (
        mention.isCritical ||
        mention.sentiment === "negative" ||
        mention.keywords.some((keyword) =>
          ["crisis", "interrupción", "emergencia"].includes(
            keyword.toLowerCase()
          )
        )
      ) {
        const alert = createAlertFromMention(mention);
        state.alerts.unshift(alert);
        createdAlerts.push(alert);
      }
    }

    state.syncRuns.unshift({
      id: createId("sync"),
      agencyId: run.agencyId,
      sourceWindow: run.sourceWindow,
      fetchedCount: run.fetchedCount,
      insertedCount,
      duplicateCount,
      status: duplicateCount > 0 ? "partial" : "completed",
      startedAt: run.startedAt,
      finishedAt: run.finishedAt
    });

    return {
      insertedCount,
      duplicateCount,
      createdAlerts
    };
  };

  const listAgencies = (session: SessionContext) =>
    state.agencies.filter((agency) =>
      visibleAgencyIds(session).includes(agency.id)
    );

  const listUsers = (session: SessionContext) =>
    state.users.filter(
      (user) =>
        user.role === "admin" ||
        user.agencyIds.some((agencyId) => canViewAgency(session, agencyId))
    );

  const listSavedFilters = (
    session: SessionContext,
    scope?: SavedFilter["scope"]
  ) =>
    state.savedFilters.filter(
      (filter) =>
        canViewAgency(session, filter.agencyId) &&
        (!scope || filter.scope === scope) &&
        (session.role === "admin" || filter.ownerId === session.userId)
    );

  const importBrandwatchWorkbook = (
    input: BrandwatchWorkbookImportInput
  ): Promise<ImportResult> => {
    const batchId = createId("batch");
    for (const item of input.items) {
      importContextByMentionId.set(item.mention.id, {
        batchId,
        queryId: item.sourceQueryExternalId,
        rawPayload: item.rawRow.rawPayload
      });
    }

    const result = upsertMentions(
      input.items.map((item) => item.mention),
      {
        agencyId: input.agencyId,
        fetchedCount: input.items.length,
        sourceWindow: `${input.metadata.from}/${input.metadata.to}`,
        startedAt: now(),
        finishedAt: now()
      }
    );

    return Promise.resolve({
      batchId,
      rowsRead: input.items.length,
      rowsInserted: input.items.length,
      rowsDeduped: result.duplicateCount,
      mentionsUpserted: result.insertedCount,
      metricsInserted: input.items.reduce(
        (total, item) => total + item.metrics.length,
        0
      ),
      errors: [],
      createdAlerts: result.createdAlerts
    });
  };

  const repository: Repository = {
    state,
    ready: () => Promise.resolve(undefined),
    getDashboardSummary,
    getExplorationMeta,
    getExplorationSummary,
    getExplorationTimeseries,
    getExplorationHeatmap,
    getExplorationBreakdowns,
    getExplorationScatter,
    getExplorationEntities,
    listExplorationMentions,
    listEnrichmentDefinitions,
    listMentions,
    listMentionsEnriched,
    getMentionEnrichments,
    listEnrichmentRollups,
    listAlerts,
    listCases,
    listAgencies,
    listUsers,
    listSavedFilters,
    createCase,
    updateCase,
    acknowledgeAlert,
    upsertMentions,
    importBrandwatchWorkbook
  };

  return repository;
};
