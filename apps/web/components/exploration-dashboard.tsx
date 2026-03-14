"use client";

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type EnrichedMention,
  type ExplorationBreakdowns,
  type ExplorationFilters,
  type ExplorationHeatmapCell,
  type ExplorationMeta,
  type ExplorationScatterPoint,
  type ExplorationSummary,
  type ExplorationTimeseriesPoint
} from "@sac/db";
import { DataTable, EmptyState, StatCard, StatusBadge } from "@sac/ui";

import {
  CountryBars,
  DaypartHeatmap,
  EngagementBoxplot,
  LanguageDonut,
  LatencyHistogram,
  PlatformMixBars,
  PublicationTreemap,
  RiskAttentionScatter,
  SentimentDivergingBars,
  TimeSeriesDualChart,
  TimeSeriesStackedChart
} from "@/components/exploration-charts";
import { formatDateTime, toneFromStatus } from "@/lib/format";

const buildQueryString = (values: Record<string, string>) => {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
};

const toFilterValues = (filters: ExplorationFilters) => ({
  agencyId: filters.agencyId ?? "",
  batchId: filters.batchId ?? "",
  sourceQueryId: filters.sourceQueryId ?? "",
  sourceClass: filters.sourceClass ?? "",
  platformFamily: filters.platformFamily ?? "",
  sentiment: filters.sentiment ?? "",
  language: filters.language ?? "",
  country: filters.country ?? "",
  priority: filters.priority ?? "",
  q: filters.q ?? "",
  from: filters.from ?? "",
  to: filters.to ?? ""
});

type FilterValues = ReturnType<typeof toFilterValues>;

const applyPatchToValues = (
  current: FilterValues,
  patch: Record<string, string | undefined>
) => {
  const currentRecord = current as Record<string, string>;
  return Object.fromEntries(
    Object.entries({
      ...currentRecord,
      ...Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [
          key,
          value && currentRecord[key] === value ? "" : (value ?? "")
        ])
      )
    })
  ) as FilterValues;
};

const presetFromMeta = (
  preset: "latest" | "seven-days" | "puerto-rico" | "negative" | "social",
  baseValues: FilterValues,
  meta: ExplorationMeta
): FilterValues => {
  switch (preset) {
    case "latest":
      return {
        ...baseValues,
        batchId: meta.defaults.batchId ?? "",
        sourceQueryId: "",
        from: meta.defaults.from ?? "",
        to: meta.defaults.to ?? ""
      };
    case "seven-days": {
      const endDate = baseValues.to || meta.defaults.to;
      if (!endDate) {
        return baseValues;
      }
      const end = new Date(endDate);
      const start = new Date(end);
      start.setDate(end.getDate() - 7);
      return {
        ...baseValues,
        from: start.toISOString(),
        to: end.toISOString()
      };
    }
    case "puerto-rico":
      return {
        ...baseValues,
        country: "Puerto Rico"
      };
    case "negative":
      return {
        ...baseValues,
        sentiment: "negative"
      };
    case "social":
      return {
        ...baseValues,
        sourceClass: "social"
      };
    default:
      return baseValues;
  }
};

const formatDrawerValue = (value: unknown, fallback = "N/D") => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  return fallback;
};

const InsightDrawer = ({
  mentionId,
  onClose
}: {
  mentionId?: string;
  onClose: () => void;
}) => {
  const [record, setRecord] = useState<EnrichedMention | null>(null);
  const [loadedMentionId, setLoadedMentionId] = useState<string>();
  const [errorMentionId, setErrorMentionId] = useState<string>();

  useEffect(() => {
    if (!mentionId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/mentions/${mentionId}/enrichments`);
        const payload = (await response.json()) as { data: EnrichedMention };
        if (!cancelled) {
          setRecord(payload.data);
          setLoadedMentionId(mentionId);
          setErrorMentionId(undefined);
        }
      } catch {
        if (!cancelled) {
          setErrorMentionId(mentionId);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [mentionId]);

  const status = !mentionId
    ? "idle"
    : errorMentionId === mentionId
      ? "error"
      : loadedMentionId === mentionId
        ? "ready"
        : "loading";
  const visibleRecord =
    mentionId && loadedMentionId === mentionId ? record : null;

  return (
    <aside className={`insight-drawer ${mentionId ? "is-open" : ""}`}>
      <div className="insight-drawer__header">
        <div>
          <span className="app-shell__eyebrow">Inspección</span>
          <h3>Detalle de mención</h3>
        </div>
        <button
          className="button button--ghost"
          onClick={onClose}
          type="button"
        >
          Cerrar
        </button>
      </div>
      {status === "loading" ? <p>Cargando enrichments…</p> : null}
      {status === "error" ? <p>No se pudo cargar la mención.</p> : null}
      {visibleRecord ? (
        <div className="insight-drawer__content">
          <div className="insight-drawer__summary">
            <h4>{visibleRecord.title ?? "Mención sin título"}</h4>
            <p>{visibleRecord.body}</p>
            <div className="toolbar-stack">
              <StatusBadge
                label={visibleRecord.sentiment}
                tone={toneFromStatus(visibleRecord.priority)}
              />
              <StatusBadge
                label={visibleRecord.priority}
                tone={toneFromStatus(visibleRecord.priority)}
              />
              <StatusBadge
                label={formatDrawerValue(
                  visibleRecord.enrichments.platform_family,
                  visibleRecord.channel
                )}
                tone="info"
              />
            </div>
          </div>
          <dl className="insight-drawer__metrics">
            {[
              [
                "Atención",
                formatDrawerValue(
                  visibleRecord.enrichments.earned_attention_index,
                  "0"
                )
              ],
              [
                "Riesgo",
                formatDrawerValue(
                  visibleRecord.enrichments.risk_base_score,
                  "0"
                )
              ],
              [
                "Latencia",
                `${formatDrawerValue(
                  visibleRecord.enrichments.capture_latency_minutes,
                  "0"
                )} min`
              ],
              [
                "Dominio",
                formatDrawerValue(
                  visibleRecord.enrichments.normalized_url_host,
                  "Sin dominio"
                )
              ],
              [
                "País",
                formatDrawerValue(
                  visibleRecord.enrichments.country_region_city_key,
                  "Unknown"
                )
              ],
              [
                "Interacciones",
                formatDrawerValue(
                  visibleRecord.enrichments.total_interactions_base,
                  "0"
                )
              ]
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <a
            className="button button--primary"
            href={visibleRecord.url}
            rel="noreferrer"
            target="_blank"
          >
            Abrir fuente
          </a>
        </div>
      ) : null}
    </aside>
  );
};

const ExplorationFilterBar = ({
  filters,
  meta,
  onNavigate
}: {
  filters: ExplorationFilters;
  meta: ExplorationMeta;
  onNavigate: (values: FilterValues) => void;
}) => {
  const searchParams = useSearchParams();
  const [values, setValues] = useState<FilterValues>(toFilterValues(filters));

  useEffect(() => {
    setValues(toFilterValues(filters));
  }, [filters]);

  useEffect(() => {
    if (searchParams.size > 0) {
      window.localStorage.setItem(
        "exploration-filters",
        JSON.stringify(values)
      );
      return;
    }

    const persisted = window.localStorage.getItem("exploration-filters");
    if (persisted) {
      onNavigate(JSON.parse(persisted) as FilterValues);
      return;
    }

    onNavigate(values);
  }, [onNavigate, searchParams.size, values]);

  const submit = () => {
    window.localStorage.setItem("exploration-filters", JSON.stringify(values));
    onNavigate(values);
  };

  return (
    <section className="panel panel--sticky">
      <div className="exploration-header">
        <div>
          <span className="app-shell__eyebrow">Exploración</span>
          <h3 className="chart-card__title">Capa analítica base</h3>
          <p className="chart-card__description">
            Los filtros viven en URL y persisten por navegador.
          </p>
        </div>
        <div className="preset-row">
          {[
            ["latest", "Último batch"],
            ["seven-days", "Últimos 7 días"],
            ["puerto-rico", "Solo Puerto Rico"],
            ["negative", "Solo negativas"],
            ["social", "Solo social"]
          ].map(([value, label]) => (
            <button
              className="button button--ghost"
              key={value}
              onClick={() =>
                setValues((current) =>
                  presetFromMeta(
                    value as Parameters<typeof presetFromMeta>[0],
                    current,
                    meta
                  )
                )
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="exploration-filter-grid">
        <label className="filter-bar__field">
          <span>Agencia</span>
          <select
            value={values.agencyId}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                agencyId: event.target.value
              }))
            }
          >
            {meta.agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Batch</span>
          <select
            value={values.batchId}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                batchId: event.target.value
              }))
            }
          >
            <option value="">Todos</option>
            {meta.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Query</span>
          <select
            value={values.sourceQueryId}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sourceQueryId: event.target.value
              }))
            }
          >
            <option value="">Todas</option>
            {meta.queries.map((query) => (
              <option key={query.id} value={query.id}>
                {query.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Fuente</span>
          <select
            value={values.sourceClass}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sourceClass: event.target.value
              }))
            }
          >
            <option value="">Todas</option>
            {meta.sourceClasses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Plataforma</span>
          <select
            value={values.platformFamily}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                platformFamily: event.target.value
              }))
            }
          >
            <option value="">Todas</option>
            {meta.platformFamilies.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Sentimiento</span>
          <select
            value={values.sentiment}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                sentiment: event.target.value
              }))
            }
          >
            <option value="">Todos</option>
            {meta.sentiments.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Idioma</span>
          <select
            value={values.language}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                language: event.target.value
              }))
            }
          >
            <option value="">Todos</option>
            {meta.languages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>País</span>
          <select
            value={values.country}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                country: event.target.value
              }))
            }
          >
            <option value="">Todos</option>
            {meta.countries.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Prioridad</span>
          <select
            value={values.priority}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                priority: event.target.value
              }))
            }
          >
            <option value="">Todas</option>
            {meta.priorities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-bar__field">
          <span>Buscar</span>
          <input
            type="search"
            value={values.q}
            onChange={(event) =>
              setValues((current) => ({ ...current, q: event.target.value }))
            }
          />
        </label>
        <label className="filter-bar__field">
          <span>Desde</span>
          <input
            type="datetime-local"
            value={values.from.slice(0, 16)}
            onChange={(event) =>
              setValues((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label className="filter-bar__field">
          <span>Hasta</span>
          <input
            type="datetime-local"
            value={values.to.slice(0, 16)}
            onChange={(event) =>
              setValues((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="filter-bar__actions">
        <button
          className="button button--primary"
          onClick={submit}
          type="button"
        >
          Aplicar filtros
        </button>
        <button
          className="button button--ghost"
          onClick={() => {
            const reset = toFilterValues({
              agencyId: meta.defaults.agencyId,
              batchId: meta.defaults.batchId,
              from: meta.defaults.from,
              to: meta.defaults.to
            });
            setValues(reset);
            window.localStorage.setItem(
              "exploration-filters",
              JSON.stringify(reset)
            );
            onNavigate(reset);
          }}
          type="button"
        >
          Reset
        </button>
      </div>
    </section>
  );
};

type ExplorationDashboardProps = {
  filters: ExplorationFilters;
  meta: ExplorationMeta;
  summary: ExplorationSummary;
  timeseries: ExplorationTimeseriesPoint[];
  heatmap: ExplorationHeatmapCell[];
  breakdowns: ExplorationBreakdowns;
  scatter: ExplorationScatterPoint[];
  entities: {
    topPublicationsOrDomains: { key: string; label: string; value: number }[];
    mentionTable: Array<{
      id: string;
      title: string;
      bodyPreview: string;
      url: string;
      platformFamily: string;
      sourceClass: string;
      sentiment: string;
      priority: string;
      authorName: string;
      occurredAt: string;
      country: string;
      earnedAttentionIndex: number;
      riskBaseScore: number;
      totalInteractionsBase: number;
      isCritical: boolean;
    }>;
  };
};

export const ExplorationDashboard = ({
  filters,
  meta,
  summary,
  timeseries,
  heatmap,
  breakdowns,
  scatter,
  entities
}: ExplorationDashboardProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedMentionId, setSelectedMentionId] = useState<string>();
  const activeBatch = meta.batches.find(
    (batch) => batch.id === filters.batchId
  );
  const activeQuery = meta.queries.find(
    (query) => query.id === filters.sourceQueryId
  );

  const navigateWithValues = (values: FilterValues) => {
    startTransition(() => {
      const query = buildQueryString(values);
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  const applyFilter = (patch: Record<string, string | undefined>) =>
    navigateWithValues(applyPatchToValues(toFilterValues(filters), patch));

  return (
    <div className="exploration-layout">
      <div className="stack">
        <section className="panel exploration-hero">
          <div>
            <span className="app-shell__eyebrow">Analista de datos</span>
            <h3 className="chart-card__title">
              Radar exploratorio del monitoreo
            </h3>
            <p className="chart-card__description">
              Batch activo: {activeBatch?.label ?? "Todos"} · Query activa:{" "}
              {activeQuery?.label ?? activeBatch?.queryLabel ?? "Todas"}
            </p>
          </div>
          <div className="toolbar-stack exploration-hero__meta">
            <StatusBadge
              label={filters.agencyId ?? meta.defaults.agencyId}
              tone="info"
            />
            {summary.lastIngestedAt ? (
              <StatusBadge
                label={`Última ingesta ${formatDateTime(summary.lastIngestedAt)}`}
                tone="default"
              />
            ) : null}
          </div>
        </section>

        <ExplorationFilterBar
          filters={filters}
          meta={meta}
          onNavigate={navigateWithValues}
        />

        <section className="stats-grid stats-grid--exploration">
          <StatCard
            detail="corte filtrado"
            label="Menciones"
            value={String(summary.totalMentions)}
          />
          <StatCard
            detail="tono negativo"
            label="Negativas"
            tone="critical"
            value={String(summary.negativeMentions)}
          />
          <StatCard
            detail="criticidad"
            label="Críticas"
            tone="critical"
            value={String(summary.criticalMentions)}
          />
          <StatCard
            detail="promedio"
            label="Riesgo"
            value={summary.avgRiskBaseScore.toFixed(2)}
          />
          <StatCard
            detail="promedio"
            label="Atención"
            tone="positive"
            value={summary.avgEarnedAttentionIndex.toFixed(2)}
          />
          <StatCard
            detail="captura"
            label="Latencia"
            value={`${summary.avgCaptureLatencyMinutes.toFixed(1)} min`}
          />
        </section>

        <section className="exploration-grid exploration-grid--hero">
          <TimeSeriesStackedChart
            points={timeseries}
            onBrush={(range) => applyFilter(range)}
          />
          <TimeSeriesDualChart points={timeseries} />
        </section>

        <section className="exploration-grid exploration-grid--three">
          <DaypartHeatmap cells={heatmap} />
          <SentimentDivergingBars
            onFilter={applyFilter}
            rows={breakdowns.sentimentByPlatform}
          />
          <RiskAttentionScatter
            onSelectMention={setSelectedMentionId}
            points={scatter}
          />
        </section>

        <section className="exploration-grid exploration-grid--three">
          <LatencyHistogram bins={breakdowns.latencyHistogram} />
          <PlatformMixBars
            onFilter={applyFilter}
            rows={breakdowns.platformFamily}
          />
          <CountryBars onFilter={applyFilter} rows={breakdowns.country} />
        </section>

        <section className="exploration-grid exploration-grid--three">
          <LanguageDonut onFilter={applyFilter} rows={breakdowns.language} />
          <PublicationTreemap nodes={entities.topPublicationsOrDomains} />
          <EngagementBoxplot
            onFilter={applyFilter}
            rows={breakdowns.interactionBoxplotByPlatform}
          />
        </section>

        <section className="panel">
          <div className="chart-card__header">
            <div>
              <h3 className="chart-card__title">Menciones destacadas</h3>
              <p className="chart-card__description">
                Ordenadas por atención ganada. Haz clic en una fila para
                inspección.
              </p>
            </div>
          </div>
          {entities.mentionTable.length === 0 ? (
            <EmptyState>No hay menciones para el corte actual.</EmptyState>
          ) : (
            <DataTable
              headers={[
                "Mención",
                "Canal",
                "País",
                "Riesgo",
                "Atención",
                "Hora",
                "Acción"
              ]}
              rows={entities.mentionTable.map((mention) => [
                <div key={`${mention.id}-content`}>
                  <strong>{mention.title}</strong>
                  <p>{mention.bodyPreview}</p>
                </div>,
                <div key={`${mention.id}-channel`}>
                  <strong>{mention.platformFamily}</strong>
                  <small>{mention.sourceClass}</small>
                </div>,
                mention.country,
                mention.riskBaseScore.toFixed(2),
                mention.earnedAttentionIndex.toFixed(2),
                formatDateTime(mention.occurredAt),
                <button
                  className="button button--ghost"
                  key={`${mention.id}-action`}
                  onClick={() => setSelectedMentionId(mention.id)}
                  type="button"
                >
                  Inspeccionar
                </button>
              ])}
            />
          )}
        </section>
      </div>

      <InsightDrawer
        mentionId={selectedMentionId}
        onClose={() => setSelectedMentionId(undefined)}
      />
    </div>
  );
};
