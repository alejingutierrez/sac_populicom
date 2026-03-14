"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

import {
  arc,
  area,
  brushX,
  hierarchy,
  line,
  pie,
  scaleBand,
  scaleLinear,
  scaleOrdinal,
  scaleSqrt,
  schemeTableau10,
  select,
  stack,
  treemap
} from "d3";

import type {
  ExplorationBoxplotStat,
  ExplorationBreakdownItem,
  ExplorationEntityNode,
  ExplorationHeatmapCell,
  ExplorationHistogramBin,
  ExplorationScatterPoint,
  ExplorationSentimentByPlatform,
  ExplorationTimeseriesPoint
} from "@sac/db";

const CHART_MARGIN = { top: 16, right: 20, bottom: 36, left: 48 };
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#0b7a48",
  neutral: "#7384a3",
  negative: "#b42318",
  mixed: "#c77700"
};
const DAYPART_COLORS = ["#eff4fb", "#bfd5ff", "#6ca6ff", "#0057b8"];
const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo"
};
const numberFormat = new Intl.NumberFormat("es-PR");
const compactNumberFormat = new Intl.NumberFormat("es-PR", {
  notation: "compact",
  maximumFractionDigits: 1
});

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

type ClickFilterHandler = (filters: Record<string, string | undefined>) => void;

const ChartCard = ({
  title,
  description,
  actions,
  children
}: ChartCardProps) => (
  <article className="panel chart-card">
    <div className="chart-card__header">
      <div>
        <h3 className="chart-card__title">{title}</h3>
        <p className="chart-card__description">{description}</p>
      </div>
      {actions ? <div className="chart-card__actions">{actions}</div> : null}
    </div>
    {children}
  </article>
);

const tickLabels = (labels: string[], desired = 6) => {
  if (labels.length <= desired) {
    return labels;
  }

  const step = Math.ceil(labels.length / desired);
  return labels.filter((_, index) => index % step === 0);
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const platformColorScale = (keys: string[]) =>
  scaleOrdinal<string, string>().domain(keys).range(schemeTableau10);

export const TimeSeriesStackedChart = ({
  points,
  onBrush
}: {
  points: ExplorationTimeseriesPoint[];
  onBrush: (range: { from: string; to: string }) => void;
}) => {
  const brushId = useId();
  const brushRef = useRef<SVGGElement | null>(null);
  const width = 920;
  const height = 280;
  const platformKeys = Array.from(
    new Set(points.flatMap((point) => Object.keys(point.platformCounts)))
  );
  const colorScale = platformColorScale(platformKeys);
  const xScale = scaleLinear()
    .domain([0, Math.max(points.length - 1, 1)])
    .range([CHART_MARGIN.left, width - CHART_MARGIN.right]);
  const maxStack = Math.max(
    ...points.map((point) =>
      Object.values(point.platformCounts).reduce((sum, value) => sum + value, 0)
    ),
    1
  );
  const yScale = scaleLinear()
    .domain([0, maxStack])
    .range([height - CHART_MARGIN.bottom, CHART_MARGIN.top]);
  const stackedData = stack<Record<string, number>, string>()
    .keys(platformKeys)
    .value((datum: Record<string, number>, key: string) => datum[key] ?? 0)(
    points.map((point) => point.platformCounts)
  );
  const areaGenerator = area<[number, number]>()
    .x((_, index: number) => xScale(index))
    .y0((segment: [number, number]) => yScale(segment[0]))
    .y1((segment: [number, number]) => yScale(segment[1]));

  useEffect(() => {
    if (!brushRef.current || points.length < 2) {
      return;
    }

    const brush = brushX()
      .extent([
        [CHART_MARGIN.left, CHART_MARGIN.top],
        [width - CHART_MARGIN.right, height - CHART_MARGIN.bottom]
      ])
      .on("end", (event: { selection: [number, number] | null }) => {
        if (!event.selection) {
          return;
        }

        const [left, right] = event.selection;
        const fromIndex = Math.max(
          0,
          Math.min(points.length - 1, Math.round(xScale.invert(left)))
        );
        const toIndex = Math.max(
          0,
          Math.min(points.length - 1, Math.round(xScale.invert(right)))
        );
        const fromPoint = points[Math.min(fromIndex, toIndex)];
        const toPoint = points[Math.max(fromIndex, toIndex)];
        if (fromPoint && toPoint) {
          onBrush({
            from: fromPoint.bucket,
            to: toPoint.bucket
          });
        }
      });

    select(brushRef.current).call(brush as never);
  }, [height, onBrush, points, width, xScale]);

  const xTicks = tickLabels(points.map((point) => point.label));

  return (
    <ChartCard
      title="Volumen por plataforma"
      description="Serie temporal apilada. Arrastra sobre la gráfica para actualizar el rango."
      actions={
        <div className="chart-legend">
          {platformKeys.map((key) => (
            <span className="chart-legend__item" key={key}>
              <span
                className="chart-legend__swatch"
                style={{ backgroundColor: colorScale(key) }}
              />
              {key}
            </span>
          ))}
        </div>
      }
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {stackedData.map((series: (typeof stackedData)[number]) => (
          <path
            d={areaGenerator(series as Array<[number, number]>) ?? undefined}
            fill={colorScale(series.key)}
            fillOpacity={0.8}
            key={series.key}
            stroke="#fff"
            strokeWidth={1}
          >
            <title>{series.key}</title>
          </path>
        ))}
        {xTicks.map((label) => {
          const index = points.findIndex((point) => point.label === label);
          return (
            <text
              className="chart-axis__label"
              key={label}
              textAnchor="middle"
              x={xScale(index)}
              y={height - 10}
            >
              {label}
            </text>
          );
        })}
        {[0, maxStack / 2, maxStack].map((tick) => (
          <g key={tick}>
            <line
              stroke="rgba(19, 35, 62, 0.12)"
              x1={CHART_MARGIN.left}
              x2={width - CHART_MARGIN.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
            />
            <text className="chart-axis__label" x={12} y={yScale(tick) + 4}>
              {numberFormat.format(Math.round(tick))}
            </text>
          </g>
        ))}
        <g id={brushId} ref={brushRef} />
      </svg>
    </ChartCard>
  );
};

export const TimeSeriesDualChart = ({
  points
}: {
  points: ExplorationTimeseriesPoint[];
}) => {
  const width = 920;
  const height = 250;
  const xScale = scaleLinear()
    .domain([0, Math.max(points.length - 1, 1)])
    .range([CHART_MARGIN.left, width - CHART_MARGIN.right]);
  const maxValue = Math.max(
    ...points.map((point) =>
      Math.max(point.negativeCount, point.criticalCount)
    ),
    1
  );
  const yScale = scaleLinear()
    .domain([0, maxValue])
    .range([height - CHART_MARGIN.bottom, CHART_MARGIN.top]);
  const lineGenerator = line<ExplorationTimeseriesPoint>()
    .x((_, index: number) => xScale(index))
    .y((point: ExplorationTimeseriesPoint) => yScale(point.negativeCount));
  const criticalLineGenerator = line<ExplorationTimeseriesPoint>()
    .x((_, index: number) => xScale(index))
    .y((point: ExplorationTimeseriesPoint) => yScale(point.criticalCount));

  return (
    <ChartCard
      title="Negativas vs críticas"
      description="Contraste del tono negativo frente a la criticidad operacional."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        <path
          d={lineGenerator(points) ?? undefined}
          fill="none"
          stroke={SENTIMENT_COLORS.negative}
          strokeWidth={3}
        />
        <path
          d={criticalLineGenerator(points) ?? undefined}
          fill="none"
          stroke="#0057b8"
          strokeDasharray="6 6"
          strokeWidth={3}
        />
        {points.map((point, index) => (
          <g key={point.bucket}>
            <circle
              cx={xScale(index)}
              cy={yScale(point.negativeCount)}
              fill={SENTIMENT_COLORS.negative}
              r={4}
            >
              <title>{`${point.label}: negativas ${point.negativeCount}`}</title>
            </circle>
            <circle
              cx={xScale(index)}
              cy={yScale(point.criticalCount)}
              fill="#0057b8"
              r={4}
            >
              <title>{`${point.label}: críticas ${point.criticalCount}`}</title>
            </circle>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
};

export const DaypartHeatmap = ({
  cells
}: {
  cells: ExplorationHeatmapCell[];
}) => {
  const width = 520;
  const height = 260;
  const weekdays = Array.from(new Set(cells.map((cell) => cell.weekday)));
  const dayparts = Array.from(new Set(cells.map((cell) => cell.daypart)));
  const xScale = scaleBand()
    .domain(dayparts)
    .range([110, width - 24])
    .padding(0.16);
  const yScale = scaleBand()
    .domain(weekdays)
    .range([26, height - 30])
    .padding(0.16);
  const maxCount = Math.max(...cells.map((cell) => cell.count), 1);
  const colorScale = scaleLinear<string>()
    .domain([0, maxCount / 2, maxCount])
    .range(DAYPART_COLORS);

  return (
    <ChartCard
      title="Mapa de calor temporal"
      description="Cruza día de semana y franja horaria para detectar patrones de publicación."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {cells.map((cell) => (
          <g key={`${cell.weekday}-${cell.daypart}`}>
            <rect
              fill={colorScale(cell.count)}
              height={yScale.bandwidth()}
              rx={12}
              width={xScale.bandwidth()}
              x={xScale(cell.daypart)}
              y={yScale(cell.weekday)}
            >
              <title>{`${WEEKDAY_LABELS[cell.weekday] ?? cell.weekday} / ${cell.daypart}: ${cell.count}`}</title>
            </rect>
            <text
              className="chart-value"
              textAnchor="middle"
              x={(xScale(cell.daypart) ?? 0) + xScale.bandwidth() / 2}
              y={(yScale(cell.weekday) ?? 0) + yScale.bandwidth() / 2 + 5}
            >
              {cell.count}
            </text>
          </g>
        ))}
        {dayparts.map((daypart) => (
          <text
            className="chart-axis__label"
            key={daypart}
            textAnchor="middle"
            x={(xScale(daypart) ?? 0) + xScale.bandwidth() / 2}
            y={height - 8}
          >
            {daypart}
          </text>
        ))}
        {weekdays.map((weekday) => (
          <text
            className="chart-axis__label"
            key={weekday}
            textAnchor="end"
            x={96}
            y={(yScale(weekday) ?? 0) + yScale.bandwidth() / 2 + 5}
          >
            {WEEKDAY_LABELS[weekday] ?? weekday}
          </text>
        ))}
      </svg>
    </ChartCard>
  );
};

export const SentimentDivergingBars = ({
  rows,
  onFilter
}: {
  rows: ExplorationSentimentByPlatform[];
  onFilter: ClickFilterHandler;
}) => {
  const width = 560;
  const height = 280;
  const xScale = scaleLinear()
    .domain([-1, 1])
    .range([80, width - 32]);
  const yScale = scaleBand()
    .domain(rows.map((row) => row.platformFamily))
    .range([24, height - 30])
    .padding(0.18);

  return (
    <ChartCard
      title="Sentimiento por plataforma"
      description="Lectura divergente para comparar carga negativa y positiva por canal."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        <line
          stroke="rgba(19, 35, 62, 0.18)"
          x1={xScale(0)}
          x2={xScale(0)}
          y1={16}
          y2={height - 18}
        />
        {rows.map((row) => {
          const negativeShare = row.total ? row.negative / row.total : 0;
          const positiveShare = row.total ? row.positive / row.total : 0;
          const y = yScale(row.platformFamily) ?? 0;

          return (
            <g key={row.platformFamily}>
              <rect
                className="chart-clickable"
                fill={SENTIMENT_COLORS.negative}
                height={yScale.bandwidth()}
                rx={10}
                width={xScale(0) - xScale(-negativeShare)}
                x={xScale(-negativeShare)}
                y={y}
                onClick={() => onFilter({ platformFamily: row.platformFamily })}
              >
                <title>{`${row.platformFamily}: ${formatPercent(negativeShare)} negativas`}</title>
              </rect>
              <rect
                className="chart-clickable"
                fill={SENTIMENT_COLORS.positive}
                height={yScale.bandwidth()}
                rx={10}
                width={xScale(positiveShare) - xScale(0)}
                x={xScale(0)}
                y={y}
                onClick={() => onFilter({ platformFamily: row.platformFamily })}
              >
                <title>{`${row.platformFamily}: ${formatPercent(positiveShare)} positivas`}</title>
              </rect>
              <text
                className="chart-axis__label"
                x={12}
                y={y + yScale.bandwidth() / 2 + 5}
              >
                {row.platformFamily}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
};

export const RiskAttentionScatter = ({
  points,
  onSelectMention
}: {
  points: ExplorationScatterPoint[];
  onSelectMention: (mentionId: string) => void;
}) => {
  const width = 560;
  const height = 320;
  const xScale = scaleLinear()
    .domain([0, Math.max(...points.map((point) => point.riskBaseScore), 1)])
    .range([60, width - 24]);
  const yScale = scaleLinear()
    .domain([
      0,
      Math.max(...points.map((point) => point.earnedAttentionIndex), 0.1)
    ])
    .range([height - 34, 24]);
  const radiusScale = scaleSqrt()
    .domain([
      0,
      Math.max(...points.map((point) => point.totalInteractionsBase), 1)
    ])
    .range([4, 18]);

  return (
    <ChartCard
      title="Riesgo vs atención"
      description="Cada burbuja es una mención. Haz clic para inspección detallada."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {[0, xScale.domain()[1]].map((tick) => (
          <text
            className="chart-axis__label"
            key={`x-${tick}`}
            x={xScale(tick)}
            y={height - 10}
          >
            {tick}
          </text>
        ))}
        {[0, yScale.domain()[1]].map((tick) => (
          <text
            className="chart-axis__label"
            key={`y-${tick}`}
            x={12}
            y={yScale(tick) + 4}
          >
            {tick.toFixed(2)}
          </text>
        ))}
        {points.map((point) => (
          <circle
            className="chart-clickable"
            cx={xScale(point.riskBaseScore)}
            cy={yScale(point.earnedAttentionIndex)}
            fill={SENTIMENT_COLORS[point.sentiment]}
            fillOpacity={0.7}
            key={point.id}
            r={radiusScale(point.totalInteractionsBase)}
            stroke={point.isCritical ? "#13233e" : "white"}
            strokeWidth={point.isCritical ? 2.2 : 1}
            onClick={() => onSelectMention(point.id)}
          >
            <title>{`${point.title}\n${point.platformFamily}\nRiesgo ${point.riskBaseScore} | Atención ${point.earnedAttentionIndex.toFixed(2)} | Interacciones ${numberFormat.format(point.totalInteractionsBase)}`}</title>
          </circle>
        ))}
      </svg>
    </ChartCard>
  );
};

export const LatencyHistogram = ({
  bins
}: {
  bins: ExplorationHistogramBin[];
}) => {
  const width = 520;
  const height = 250;
  const xScale = scaleBand()
    .domain(bins.map((_, index) => String(index)))
    .range([48, width - 16])
    .padding(0.18);
  const yScale = scaleLinear()
    .domain([0, Math.max(...bins.map((bin) => bin.count), 1)])
    .range([height - 30, 20]);

  return (
    <ChartCard
      title="Latencia de captura"
      description="Distribución del tiempo entre ocurrencia y captura de la mención."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {bins.map((bin, index) => (
          <g key={`${bin.x0}-${bin.x1}`}>
            <rect
              fill="#80b6ff"
              height={height - 30 - yScale(bin.count)}
              rx={10}
              width={xScale.bandwidth()}
              x={xScale(String(index))}
              y={yScale(bin.count)}
            >
              <title>{`${bin.x0.toFixed(0)}-${bin.x1.toFixed(0)} min: ${bin.count}`}</title>
            </rect>
            <text
              className="chart-axis__label"
              textAnchor="middle"
              x={(xScale(String(index)) ?? 0) + xScale.bandwidth() / 2}
              y={height - 10}
            >
              {`${bin.x0.toFixed(0)}-${bin.x1.toFixed(0)}`}
            </text>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
};

export const PlatformMixBars = ({
  rows,
  onFilter
}: {
  rows: ExplorationBreakdownItem[];
  onFilter: ClickFilterHandler;
}) => {
  const width = 520;
  const height = 320;
  const xScale = scaleLinear()
    .domain([0, Math.max(...rows.map((row) => row.count), 1)])
    .range([120, width - 24]);
  const yScale = scaleBand()
    .domain(rows.map((row) => row.label))
    .range([20, height - 20])
    .padding(0.16);
  const colorScale = platformColorScale(rows.map((row) => row.label));

  return (
    <ChartCard
      title="Mezcla por plataforma"
      description="Distribución absoluta por familia de plataforma."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {rows.map((row) => (
          <g key={row.key}>
            <text
              className="chart-axis__label"
              x={12}
              y={(yScale(row.label) ?? 0) + yScale.bandwidth() / 2 + 5}
            >
              {row.label}
            </text>
            <rect
              className="chart-clickable"
              fill={colorScale(row.label)}
              height={yScale.bandwidth()}
              rx={12}
              width={xScale(row.count) - 120}
              x={120}
              y={yScale(row.label)}
              onClick={() => onFilter({ platformFamily: row.key })}
            >
              <title>{`${row.label}: ${numberFormat.format(row.count)} menciones`}</title>
            </rect>
            <text
              className="chart-value"
              x={xScale(row.count) + 8}
              y={(yScale(row.label) ?? 0) + yScale.bandwidth() / 2 + 5}
            >
              {numberFormat.format(row.count)}
            </text>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
};

export const CountryBars = ({
  rows,
  onFilter
}: {
  rows: ExplorationBreakdownItem[];
  onFilter: ClickFilterHandler;
}) => {
  const width = 520;
  const height = 320;
  const xScale = scaleLinear()
    .domain([0, Math.max(...rows.map((row) => row.count), 1)])
    .range([140, width - 20]);
  const yScale = scaleBand()
    .domain(rows.map((row) => row.label))
    .range([18, height - 20])
    .padding(0.16);

  return (
    <ChartCard
      title="Países principales"
      description="El bucket Unknown se mantiene explícito para visualizar la cobertura geográfica real."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {rows.map((row) => (
          <g key={row.key}>
            <text
              className="chart-axis__label"
              x={12}
              y={(yScale(row.label) ?? 0) + yScale.bandwidth() / 2 + 5}
            >
              {row.label}
            </text>
            <rect
              className="chart-clickable"
              fill={row.key === "Unknown" ? "#7384a3" : "#0057b8"}
              height={yScale.bandwidth()}
              rx={12}
              width={xScale(row.count) - 140}
              x={140}
              y={yScale(row.label)}
              onClick={() =>
                onFilter({
                  country: row.key === "Unknown" ? undefined : row.key
                })
              }
            >
              <title>{`${row.label}: ${numberFormat.format(row.count)} menciones`}</title>
            </rect>
            <text
              className="chart-value"
              x={xScale(row.count) + 8}
              y={(yScale(row.label) ?? 0) + yScale.bandwidth() / 2 + 5}
            >
              {formatPercent(row.share)}
            </text>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
};

export const LanguageDonut = ({
  rows,
  onFilter
}: {
  rows: ExplorationBreakdownItem[];
  onFilter: ClickFilterHandler;
}) => {
  const width = 360;
  const height = 320;
  const radius = Math.min(width, height) / 2 - 40;
  const colorScale = scaleOrdinal<string, string>()
    .domain(rows.map((row) => row.label))
    .range(["#0057b8", "#7fb8ff", "#dceaff", "#7384a3"]);
  const pieGenerator = pie<ExplorationBreakdownItem>().value(
    (row: ExplorationBreakdownItem) => row.count
  );
  const arcGenerator = arc<ReturnType<typeof pieGenerator>[number]>()
    .innerRadius(radius * 0.56)
    .outerRadius(radius);

  return (
    <ChartCard
      title="Idiomas"
      description="Vista rápida del mix idiomático para orientar cortes y lecturas posteriores."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {pieGenerator(rows).map((segment) => (
            <path
              className="chart-clickable"
              d={arcGenerator(segment) ?? undefined}
              fill={colorScale(segment.data.label)}
              key={segment.data.key}
              stroke="white"
              strokeWidth={2}
              onClick={() => onFilter({ language: segment.data.key })}
            >
              <title>{`${segment.data.label}: ${numberFormat.format(segment.data.count)} (${formatPercent(segment.data.share)})`}</title>
            </path>
          ))}
          <text className="chart-center__value" textAnchor="middle" y={-2}>
            {numberFormat.format(rows.reduce((sum, row) => sum + row.count, 0))}
          </text>
          <text className="chart-center__label" textAnchor="middle" y={18}>
            menciones
          </text>
        </g>
      </svg>
    </ChartCard>
  );
};

export const PublicationTreemap = ({
  nodes
}: {
  nodes: ExplorationEntityNode[];
}) => {
  const width = 520;
  const height = 320;
  const root = hierarchy({
    name: "root",
    children: nodes.map((node) => ({
      name: node.label,
      value: node.value
    }))
  } as {
    name: string;
    children: Array<{ name: string; value: number }>;
    value?: number;
  })
    .sum((node) => node.value ?? 0)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
  treemap().size([width, height]).padding(6)(root as never);
  const leaves = root.leaves() as Array<
    typeof root & { x0: number; y0: number; x1: number; y1: number }
  >;
  const colorScale = scaleOrdinal<string, string>().range([
    "#0057b8",
    "#2b7bd9",
    "#5f9ef5",
    "#8abaff",
    "#bfd5ff",
    "#dbe8ff"
  ]);

  return (
    <ChartCard
      title="Dominios dominantes"
      description="Participación de fuentes y dominios normalizados en el corte actual."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {leaves.map((leaf, index) => (
          <g
            key={leaf.data.name}
            transform={`translate(${leaf.x0}, ${leaf.y0})`}
          >
            <rect
              fill={colorScale(String(index))}
              height={leaf.y1 - leaf.y0}
              rx={14}
              width={leaf.x1 - leaf.x0}
            >
              <title>{`${leaf.data.name}: ${numberFormat.format(leaf.value ?? 0)}`}</title>
            </rect>
            <text className="chart-treemap__label" x={12} y={24}>
              {leaf.data.name}
            </text>
            <text className="chart-treemap__value" x={12} y={44}>
              {compactNumberFormat.format(leaf.value ?? 0)}
            </text>
          </g>
        ))}
      </svg>
    </ChartCard>
  );
};

export const EngagementBoxplot = ({
  rows,
  onFilter
}: {
  rows: ExplorationBoxplotStat[];
  onFilter: ClickFilterHandler;
}) => {
  const width = 560;
  const height = 300;
  const xScale = scaleBand()
    .domain(rows.map((row) => row.label))
    .range([60, width - 24])
    .padding(0.24);
  const max = Math.max(...rows.map((row) => row.max), 1);
  const yScale = scaleLinear()
    .domain([0, max])
    .range([height - 36, 18]);
  const colorScale = platformColorScale(rows.map((row) => row.label));

  return (
    <ChartCard
      title="Distribución de interacciones"
      description="Boxplot por plataforma para detectar dispersión y outliers reales."
    >
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        {rows.map((row) => {
          const x = xScale(row.label) ?? 0;
          const boxWidth = xScale.bandwidth();
          const center = x + boxWidth / 2;

          return (
            <g
              key={row.key}
              onClick={() => onFilter({ platformFamily: row.key })}
            >
              <line
                stroke="#13233e"
                x1={center}
                x2={center}
                y1={yScale(row.min)}
                y2={yScale(row.max)}
              />
              <rect
                className="chart-clickable"
                fill={colorScale(row.label)}
                fillOpacity={0.72}
                height={Math.max(8, yScale(row.q1) - yScale(row.q3))}
                rx={12}
                width={boxWidth}
                x={x}
                y={yScale(row.q3)}
              >
                <title>{`${row.label}: mediana ${compactNumberFormat.format(row.median)}`}</title>
              </rect>
              <line
                stroke="#13233e"
                strokeWidth={2}
                x1={x}
                x2={x + boxWidth}
                y1={yScale(row.median)}
                y2={yScale(row.median)}
              />
              {row.outliers.map((value, index) => (
                <circle
                  cx={center}
                  cy={yScale(value)}
                  fill="#13233e"
                  key={`${row.key}-${index}`}
                  r={3}
                />
              ))}
              <text
                className="chart-axis__label"
                textAnchor="middle"
                x={center}
                y={height - 10}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
};
