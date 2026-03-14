import { DataTable, SectionHeading, StatusBadge } from "@sac/ui";

import { DashboardShell } from "@/components/dashboard-shell";
import { ExportButtons } from "@/components/export-buttons";
import { FilterBar } from "@/components/filter-bar";
import { formatDateTime, getServerRuntime, toMentionFilters, toneFromStatus } from "@/lib/server";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ReportsPage = async ({ searchParams }: ReportsPageProps) => {
  const { repository, session } = await getServerRuntime();
  const filters = await toMentionFilters(searchParams);
  const mentions = repository.listMentions(session, filters).slice(0, 20);

  return (
    <DashboardShell
      activePath="/reportes"
      session={session}
      title="Reportes"
      subtitle="Exportaciones operativas para seguimiento y coordinación institucional."
    >
      <section className="panel">
        <SectionHeading
          title="Filtro de reporte"
          actions={
            <ExportButtons
              filters={{
                agencyId: filters.agencyId,
                source: filters.source,
                sentiment: filters.sentiment,
                priority: filters.priority,
                q: filters.q,
                from: filters.from,
                to: filters.to
              }}
            />
          }
        />
        <FilterBar
          storageKey="report-filters"
          initialValues={{
            agencyId: filters.agencyId ?? "",
            source: filters.source ?? "",
            sentiment: filters.sentiment ?? "",
            priority: filters.priority ?? "",
            q: filters.q ?? "",
            from: filters.from ?? "",
            to: filters.to ?? ""
          }}
          fields={[
            { name: "agencyId", label: "Agencia", type: "search" },
            { name: "source", label: "Fuente", type: "search" },
            { name: "sentiment", label: "Sentimiento", type: "search" },
            { name: "priority", label: "Prioridad", type: "search" },
            { name: "q", label: "Texto", type: "search" },
            { name: "from", label: "Desde", type: "date" },
            { name: "to", label: "Hasta", type: "date" }
          ]}
        />
      </section>

      <section className="panel">
        <SectionHeading title={`Vista previa (${mentions.length})`} description="Los exports usan el mismo conjunto filtrado." />
        <DataTable
          headers={["Canal", "Título", "Sentimiento", "Fecha"]}
          rows={mentions.map((mention) => [
            mention.channel,
            mention.title ?? mention.body,
            <StatusBadge key={`${mention.id}-sentiment`} label={mention.sentiment} tone={toneFromStatus(mention.priority)} />,
            formatDateTime(mention.occurredAt)
          ])}
        />
      </section>
    </DashboardShell>
  );
};

export default ReportsPage;
