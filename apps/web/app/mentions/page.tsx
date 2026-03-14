import Link from "next/link";

import { DataTable, SectionHeading, StatusBadge } from "@sac/ui";

import { DashboardShell } from "@/components/dashboard-shell";
import { FilterBar } from "@/components/filter-bar";
import {
  formatDateTime,
  getServerRuntime,
  toMentionFilters,
  toneFromStatus
} from "@/lib/server";

type MentionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const MentionsPage = async ({ searchParams }: MentionPageProps) => {
  const { repository, session } = await getServerRuntime();
  const filters = await toMentionFilters(searchParams);
  const [mentions, agencies] = await Promise.all([
    repository.listMentions(session, filters),
    repository.listAgencies(session)
  ]);

  return (
    <DashboardShell
      activePath="/mentions"
      session={session}
      title="Menciones"
      subtitle="Vista consolidada de redes sociales, noticias y web pública."
    >
      <section className="panel">
        <SectionHeading
          title="Filtros persistentes"
          description="Se guardan localmente por vista y agencia activa."
        />
        <FilterBar
          storageKey="mentions-filters"
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
            {
              name: "agencyId",
              label: "Agencia",
              type: "select",
              options: agencies.map((agency) => ({
                label: agency.name,
                value: agency.id
              }))
            },
            {
              name: "source",
              label: "Fuente",
              type: "select",
              options: [
                { label: "Social", value: "social" },
                { label: "Noticias", value: "news" },
                { label: "Web", value: "web" }
              ]
            },
            {
              name: "sentiment",
              label: "Sentimiento",
              type: "select",
              options: [
                { label: "Negativo", value: "negative" },
                { label: "Neutral", value: "neutral" },
                { label: "Positivo", value: "positive" },
                { label: "Mixto", value: "mixed" }
              ]
            },
            {
              name: "priority",
              label: "Prioridad",
              type: "select",
              options: [
                { label: "Crítica", value: "critical" },
                { label: "Alta", value: "high" },
                { label: "Media", value: "medium" },
                { label: "Baja", value: "low" }
              ]
            },
            { name: "q", label: "Búsqueda", type: "search" },
            { name: "from", label: "Desde", type: "date" },
            { name: "to", label: "Hasta", type: "date" }
          ]}
        />
      </section>

      <section className="panel">
        <SectionHeading title={`Menciones detectadas (${mentions.length})`} />
        <DataTable
          headers={[
            "Fuente",
            "Contenido",
            "Sentimiento",
            "Prioridad",
            "Hora",
            "Acción"
          ]}
          rows={mentions.map((mention) => [
            <div key={`${mention.id}-source`}>
              <strong>{mention.channel}</strong>
              <small>{mention.source}</small>
            </div>,
            <div key={`${mention.id}-content`}>
              <strong>{mention.title ?? "Mención operativa"}</strong>
              <p>{mention.body}</p>
            </div>,
            <StatusBadge
              key={`${mention.id}-sentiment`}
              label={mention.sentiment}
              tone={toneFromStatus(mention.priority)}
            />,
            <StatusBadge
              key={`${mention.id}-priority`}
              label={mention.priority}
              tone={toneFromStatus(mention.priority)}
            />,
            formatDateTime(mention.occurredAt),
            <Link
              className="button button--ghost"
              href={`/bandeja?agencyId=${mention.agencyId}&mentionId=${mention.id}`}
              key={`${mention.id}-link`}
            >
              Crear caso
            </Link>
          ])}
        />
      </section>
    </DashboardShell>
  );
};

export default MentionsPage;
