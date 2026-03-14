import { randomUUID } from "node:crypto";

import type {
  Alert,
  AlertSeverity,
  Agency,
  AlertDelivery,
  AlertRule,
  AuditLog,
  BrandwatchSyncRun,
  Case,
  CaseEvent,
  CaseStatus,
  NormalizedMention,
  RepositorySeed,
  SavedFilter,
  User
} from "./types";

const caseTransitions: Record<CaseStatus, CaseStatus[]> = {
  new: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: []
};

export const now = () => new Date().toISOString();
export const createId = (prefix: string) => `${prefix}-${randomUUID()}`;

export const assertCaseTransition = (
  currentStatus: CaseStatus,
  nextStatus: CaseStatus
) => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!caseTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(
      `Invalid case transition from ${currentStatus} to ${nextStatus}`
    );
  }
};

export const createAlertFromMention = (mention: NormalizedMention): Alert => {
  const severity: AlertSeverity =
    mention.isCritical || mention.priority === "critical" ? "critical" : "high";
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

export const createSeedData = (): RepositorySeed => {
  const timestamp = now();

  const agencies: Agency[] = [
    {
      id: "pr-central",
      slug: "pr-central",
      name: "Centro Operacional Puerto Rico",
      isActive: true
    },
    {
      id: "pr-emergency",
      slug: "pr-emergency",
      name: "Unidad de Emergencias Puerto Rico",
      isActive: true
    }
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
      sourceSystem: "brandwatch_api",
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
      sourceSystem: "brandwatch_api",
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
      sourceSystem: "brandwatch_api",
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
      description:
        "Se detectó mención crítica con alto volumen de interacción en San Juan.",
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
      summary:
        "Caso abierto para coordinación con la unidad de servicios esenciales.",
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
