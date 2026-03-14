import { DashboardShell } from "@/components/dashboard-shell";
import { ExplorationDashboard } from "@/components/exploration-dashboard";
import { getServerRuntime, resolveExplorationContext } from "@/lib/server";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DashboardPage = async ({ searchParams }: DashboardPageProps) => {
  const { repository, session } = await getServerRuntime();
  const { filters, meta } = await resolveExplorationContext(searchParams);
  const [summary, timeseries, heatmap, breakdowns, scatter, entities] =
    await Promise.all([
      repository.getExplorationSummary(session, filters),
      repository.getExplorationTimeseries(session, filters),
      repository.getExplorationHeatmap(session, filters),
      repository.getExplorationBreakdowns(session, filters),
      repository.getExplorationScatter(session, filters),
      repository.getExplorationEntities(session, filters)
    ]);

  return (
    <DashboardShell
      activePath="/"
      session={session}
      title="Exploración analítica"
      subtitle="Lectura base del universo de menciones para analistas de datos."
    >
      <ExplorationDashboard
        breakdowns={breakdowns}
        entities={entities}
        filters={filters}
        heatmap={heatmap}
        meta={meta}
        scatter={scatter}
        summary={summary}
        timeseries={timeseries}
      />
    </DashboardShell>
  );
};

export default DashboardPage;
