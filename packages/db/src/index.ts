import { canAcknowledgeAlerts, canManageCases, canViewAgency, requireAgencyAccess, type SessionContext } from "@sac/auth";

export type Agency = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "analista" | "lector";
  agencyIds: string[];
};

export type MentionSource = "social" | "news" | "web";
export type MentionSentiment = "positive" | "neutral" | "negative" | "mixed";
export type CaseStatus = "new" | "triaged" | "in_progress" | "closed";
export type CasePriority = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type AlertSeverity = "critical" | "high" | "medium";
export type DeliveryChannel = "in_app" | "email";

export type NormalizedMention = {
  id: string;
  agencyId: string;
  externalId: string;
  source: MentionSource;
  channel: string;
  title?: string;
  body: string;
  url: string;
  language: string;
  sentiment: MentionSentiment;
  priority: CasePriority;
  authorName: string;
  authorHandle?: string;
  topics: string[];
  keywords: string[];
  occurredAt: string;
  receivedAt: string;
  isCritical: boolean;
  rawObjectKey?: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };
};

export type Alert = {
  id: string;
  agencyId: string;
  mentionId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
};

export type AlertRule = {
  id: string;
  agencyId: string;
  type: "spike" | "critical_mention" | "keyword" | "negative_sentiment";
  title: string;
  threshold?: number;
  keywords?: string[];
  isActive: boolean;
};

export type AlertDelivery = {
  id: string;
  alertId: string;
  channel: DeliveryChannel;
  recipient: string;
  status: "pending" | "sent";
  deliveredAt?: string;
};

export type Case = {
  id: string;
  agencyId: string;
  mentionId?: string;
  alertId?: string;
  title: string;
  summary: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedToId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  actorId: string;
  type: "created" | "assigned" | "priority_changed" | "status_changed" | "comment";
  description: string;
  createdAt: string;
};

export type SavedFilter = {
  id: string;
  agencyId: string;
  ownerId: string;
  scope: "mentions" | "alerts" | "cases";
  payload: Record<string, string>;
};

export type AuditLog = {
  id: string;
  actorId: string;
  agencyId: string;
  action: string;
  subjectType: "mention" | "alert" | "case";
  subjectId: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type BrandwatchSyncRun = {
  id: string;
  agencyId: string;
  sourceWindow: string;
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  status: "completed" | "partial";
  startedAt: string;
  finishedAt: string;
};

export type MentionFilters = Partial<{
  agencyId: string;
  source: MentionSource;
  sentiment: MentionSentiment;
  priority: CasePriority;
  q: string;
  from: string;
  to: string;
}>;

export type DashboardSummary = {
  mentionsLast24h: number;
  openAlerts: number;
  openCases: number;
  criticalMentions: number;
  agenciesCovered: number;
};

export type CreateCaseInput = {
  agencyId: string;
  mentionId?: string;
  alertId?: string;
  title: string;
  summary: string;
  priority: CasePriority;
  assignedToId?: string;
};

export type UpdateCaseInput = Partial<{
  status: CaseStatus;
  priority: CasePriority;
  assignedToId: string;
  note: string;
}>;

export type RepositorySeed = {
  agencies: Agency[];
  users: User[];
  mentions: NormalizedMention[];
  alerts: Alert[];
  deliveries: AlertDelivery[];
  cases: Case[];
  caseEvents: CaseEvent[];
  savedFilters: SavedFilter[];
  auditLogs: AuditLog[];
  rules: AlertRule[];
  syncRuns: BrandwatchSyncRun[];
};

const caseTransitions: Record<CaseStatus, CaseStatus[]> = {
  new: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: []
};

const now = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const assertCaseTransition = (currentStatus: CaseStatus, nextStatus: CaseStatus) => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!caseTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(`Invalid case transition from ${currentStatus} to ${nextStatus}`);
  }
};

export const createSeedData = (): RepositorySeed => {
  const timestamp = now();

  const agencies: Agency[] = [
    { id: "pr-central", slug: "pr-central", name: "Centro Operacional Puerto Rico", isActive: true },
    { id: "pr-emergency", slug: "pr-emergency", name: "Unidad de Emergencias Puerto Rico", isActive: true }
  ];

  const users: User[] = [
    {
      id: "user-admin",
      email: "admin@sac.populicom.pr",
      displayName: "Coordinación Central",
      role: "admin",
      agencyIds: agencies.map((agency) => agency.id)
    },
    {
      id: "user-analyst",
      email: "analista@sac.populicom.pr",
      displayName: "Analista Regional",
      role: "analista",
      agencyIds: ["pr-central"]
    },
    {
      id: "user-reader",
      email: "lector@sac.populicom.pr",
      displayName: "Lectura Ejecutiva",
      role: "lector",
      agencyIds: ["pr-emergency"]
    }
  ];

  const mentions: NormalizedMention[] = [
    {
      id: "mention-1",
      agencyId: "pr-central",
      externalId: "bw-social-1001",
      source: "social",
      channel: "X",
      title: "Interrupción de servicio en San Juan",
      body: "Ciudadanos reportan interrupciones en el servicio y piden respuesta inmediata.",
      url: "https://social.example/pr/1001",
      language: "es",
      sentiment: "negative",
      priority: "critical",
      authorName: "Mesa Ciudadana",
      authorHandle: "@mesaciudadana",
      topics: ["servicios", "infraestructura"],
      keywords: ["interrupción", "respuesta inmediata"],
      occurredAt: timestamp,
      receivedAt: timestamp,
      isCritical: true,
      rawObjectKey: "raw/mentions/mention-1.json",
      engagement: { likes: 58, comments: 22, shares: 14, impressions: 2100 }
    },
    {
      id: "mention-2",
      agencyId: "pr-central",
      externalId: "bw-news-2002",
      source: "news",
      channel: "Noticias locales",
      title: "Cobertura sobre atención ciudadana",
      body: "Medios locales evalúan tiempos de respuesta del gobierno en trámites críticos.",
      url: "https://news.example/pr/2002",
      language: "es",
      sentiment: "neutral",
      priority: "high",
      authorName: "Redacción Caribe",
      topics: ["atención ciudadana"],
      keywords: ["tiempos de respuesta"],
      occurredAt: timestamp,
      receivedAt: timestamp,
      isCritical: false,
      rawObjectKey: "raw/mentions/mention-2.json",
      engagement: { likes: 0, comments: 0, shares: 0, impressions: 850 }
    },
    {
      id: "mention-3",
      agencyId: "pr-emergency",
      externalId: "bw-web-3003",
      source: "web",
      channel: "Blog comunitario",
      title: "Actualización de refugios",
      body: "La comunidad solicita información más clara sobre refugios disponibles.",
      url: "https://web.example/pr/3003",
      language: "es",
      sentiment: "mixed",
      priority: "medium",
      authorName: "Voz del Barrio",
      topics: ["emergencias", "refugios"],
      keywords: ["refugios"],
      occurredAt: timestamp,
      receivedAt: timestamp,
      isCritical: false,
      rawObjectKey: "raw/mentions/mention-3.json",
      engagement: { likes: 14, comments: 7, shares: 4, impressions: 640 }
    }
  ];

  const alerts: Alert[] = [
    {
      id: "alert-1",
      agencyId: "pr-central",
      mentionId: "mention-1",
      title: "Pico crítico por interrupción de servicio",
      description: "Se detectó mención crítica con alto volumen de interacción en San Juan.",
      severity: "critical",
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const deliveries: AlertDelivery[] = [
    {
      id: "delivery-1",
      alertId: "alert-1",
      channel: "in_app",
      recipient: "Centro Operacional Puerto Rico",
      status: "sent",
      deliveredAt: timestamp
    },
    {
      id: "delivery-2",
      alertId: "alert-1",
      channel: "email",
      recipient: "guardia@sac.populicom.pr",
      status: "sent",
      deliveredAt: timestamp
    }
  ];

  const cases: Case[] = [
    {
      id: "case-1",
      agencyId: "pr-central",
      mentionId: "mention-1",
      alertId: "alert-1",
      title: "Verificar interrupción en San Juan",
      summary: "Caso abierto para coordinación con la unidad de servicios esenciales.",
      status: "triaged",
      priority: "critical",
      assignedToId: "user-analyst",
      createdById: "user-admin",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const caseEvents: CaseEvent[] = [
    {
      id: "case-event-1",
      caseId: "case-1",
      actorId: "user-admin",
      type: "created",
      description: "Caso inicial generado desde alerta crítica.",
      createdAt: timestamp
    }
  ];

  const savedFilters: SavedFilter[] = [
    {
      id: "filter-1",
      agencyId: "pr-central",
      ownerId: "user-admin",
      scope: "mentions",
      payload: {
        source: "social",
        priority: "critical"
      }
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: "audit-1",
      actorId: "user-admin",
      agencyId: "pr-central",
      action: "case.created",
      subjectType: "case",
      subjectId: "case-1",
      metadata: {
        source: "alert-1"
      },
      createdAt: timestamp
    }
  ];

  const rules: AlertRule[] = [
    {
      id: "rule-1",
      agencyId: "pr-central",
      type: "critical_mention",
      title: "Mención crítica detectada",
      isActive: true
    },
    {
      id: "rule-2",
      agencyId: "pr-central",
      type: "keyword",
      title: "Palabras clave sensibles",
      keywords: ["interrupción", "crisis"],
      isActive: true
    }
  ];

  const syncRuns: BrandwatchSyncRun[] = [
    {
      id: "sync-1",
      agencyId: "pr-central",
      sourceWindow: "2026-03-13T20:00:00.000Z/2026-03-13T20:05:00.000Z",
      fetchedCount: 12,
      insertedCount: 4,
      duplicateCount: 8,
      status: "completed",
      startedAt: timestamp,
      finishedAt: timestamp
    }
  ];

  return {
    agencies,
    users,
    mentions,
    alerts,
    deliveries,
    cases,
    caseEvents,
    savedFilters,
    auditLogs,
    rules,
    syncRuns
  };
};

const matchesMentionFilters = (mention: NormalizedMention, filters: MentionFilters) => {
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
    const haystack = `${mention.title ?? ""} ${mention.body} ${mention.keywords.join(" ")} ${mention.topics.join(" ")}`.toLowerCase();
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

const createAlertFromMention = (mention: NormalizedMention): Alert => {
  const severity: AlertSeverity = mention.isCritical || mention.priority === "critical" ? "critical" : "high";
  const description = mention.isCritical
    ? "Se detectó una mención crítica que requiere triage inmediato."
    : "Se detectó una mención negativa o sensible dentro del monitoreo operativo.";

  return {
    id: createId("alert"),
    agencyId: mention.agencyId,
    mentionId: mention.id,
    title: `${mention.channel}: ${mention.title ?? "Mención operativa"}`,
    description,
    severity,
    status: "open",
    createdAt: now(),
    updatedAt: now()
  };
};

export type MemoryRepository = ReturnType<typeof createMemoryRepository>;

export const createMemoryRepository = (seed: RepositorySeed = createSeedData()) => {
  const state = structuredClone(seed);

  const visibleAgencyIds = (session: SessionContext) =>
    session.role === "admin" ? state.agencies.map((agency) => agency.id) : session.agencyIds;

  const findScopedMention = (session: SessionContext, mentionId: string) => {
    const mention = state.mentions.find((item) => item.id === mentionId);
    if (!mention) {
      throw new Error(`Mention ${mentionId} not found`);
    }

    requireAgencyAccess(session, mention.agencyId);
    return mention;
  };

  const listMentions = (session: SessionContext, filters: MentionFilters = {}) =>
    state.mentions
      .filter((mention) => visibleAgencyIds(session).includes(mention.agencyId))
      .filter((mention) => matchesMentionFilters(mention, filters))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

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
      openAlerts: scopedAlerts.filter((alert) => alert.status === "open").length,
      openCases: scopedCases.filter((record) => record.status !== "closed").length,
      criticalMentions: scopedMentions.filter((mention) => mention.isCritical).length,
      agenciesCovered: visibleAgencyIds(session).length
    };
  };

  const createCase = (session: SessionContext, input: CreateCaseInput) => {
    if (!canManageCases(session, input.agencyId)) {
      throw new Error(`Role ${session.role} cannot create cases for ${input.agencyId}`);
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

  const updateCase = (session: SessionContext, caseId: string, input: UpdateCaseInput) => {
    const record = state.cases.find((entry) => entry.id === caseId);

    if (!record) {
      throw new Error(`Case ${caseId} not found`);
    }

    if (!canManageCases(session, record.agencyId)) {
      throw new Error(`Role ${session.role} cannot update cases for ${record.agencyId}`);
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

  const acknowledgeAlert = (session: SessionContext, alertId: string) => {
    const alert = state.alerts.find((entry) => entry.id === alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (!canAcknowledgeAlerts(session, alert.agencyId)) {
      throw new Error(`Role ${session.role} cannot acknowledge alerts for ${alert.agencyId}`);
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
    run: Omit<BrandwatchSyncRun, "id" | "insertedCount" | "duplicateCount" | "status">
  ) => {
    let insertedCount = 0;
    let duplicateCount = 0;
    const createdAlerts: Alert[] = [];

    for (const mention of mentions) {
      const exists = state.mentions.some(
        (record) =>
          record.agencyId === mention.agencyId &&
          record.externalId === mention.externalId &&
          record.source === mention.source
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
        mention.keywords.some((keyword) => ["crisis", "interrupción", "emergencia"].includes(keyword.toLowerCase()))
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
    state.agencies.filter((agency) => visibleAgencyIds(session).includes(agency.id));

  const listUsers = (session: SessionContext) =>
    state.users.filter((user) => user.role === "admin" || user.agencyIds.some((agencyId) => canViewAgency(session, agencyId)));

  const listSavedFilters = (session: SessionContext, scope?: SavedFilter["scope"]) =>
    state.savedFilters.filter(
      (filter) =>
        canViewAgency(session, filter.agencyId) &&
        (!scope || filter.scope === scope) &&
        (session.role === "admin" || filter.ownerId === session.userId)
    );

  return {
    state,
    getDashboardSummary,
    listMentions,
    listAlerts,
    listCases,
    listAgencies,
    listUsers,
    listSavedFilters,
    createCase,
    updateCase,
    acknowledgeAlert,
    upsertMentions
  };
};

const singletonRepository = createMemoryRepository();

export const getRepository = () => singletonRepository;
