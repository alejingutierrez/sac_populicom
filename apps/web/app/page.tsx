import { DataTable, SectionHeading, StatCard, StatusBadge } from "@sac/ui";

import { DashboardShell } from "@/components/dashboard-shell";
import { formatDateTime, getServerRuntime, toneFromStatus } from "@/lib/server";

const DashboardPage = async () => {
  const { repository, session } = await getServerRuntime();
  const [summary, alerts, cases] = await Promise.all([
    repository.getDashboardSummary(session),
    repository.listAlerts(session),
    repository.listCases(session)
  ]);

  return (
    <DashboardShell
      activePath="/"
      session={session}
      title="Centro de monitoreo"
      subtitle="Supervisión operativa de menciones, alertas y casos por agencia."
    >
      <section className="stats-grid">
        <StatCard
          label="Menciones 24h"
          value={String(summary.mentionsLast24h)}
          detail="Cobertura de Brandwatch"
        />
        <StatCard
          label="Alertas abiertas"
          value={String(summary.openAlerts)}
          tone="critical"
          detail="In-app + email"
        />
        <StatCard
          label="Casos activos"
          value={String(summary.openCases)}
          detail="Con asignación y prioridad"
        />
        <StatCard
          label="Agencias cubiertas"
          value={String(summary.agenciesCovered)}
          tone="positive"
          detail="Scoping lógico activo"
        />
      </section>

      <section className="panel-grid">
        <section className="panel">
          <SectionHeading
            title="Alertas recientes"
            description="Severidad, estado y tiempo de creación."
          />
          <DataTable
            headers={["Título", "Severidad", "Estado", "Creada"]}
            rows={alerts
              .slice(0, 5)
              .map((alert) => [
                alert.title,
                <StatusBadge
                  key={`${alert.id}-severity`}
                  label={alert.severity}
                  tone={toneFromStatus(alert.severity)}
                />,
                <StatusBadge
                  key={`${alert.id}-status`}
                  label={alert.status}
                  tone={toneFromStatus(alert.status)}
                />,
                formatDateTime(alert.createdAt)
              ])}
          />
        </section>

        <section className="panel">
          <SectionHeading
            title="Casos activos"
            description="Triage reciente y asignación."
          />
          <DataTable
            headers={["Título", "Estado", "Prioridad", "Actualizado"]}
            rows={cases
              .slice(0, 5)
              .map((record) => [
                record.title,
                <StatusBadge
                  key={`${record.id}-status`}
                  label={record.status}
                  tone={toneFromStatus(record.status)}
                />,
                <StatusBadge
                  key={`${record.id}-priority`}
                  label={record.priority}
                  tone={toneFromStatus(record.priority)}
                />,
                formatDateTime(record.updatedAt)
              ])}
          />
        </section>
      </section>
    </DashboardShell>
  );
};

export default DashboardPage;
