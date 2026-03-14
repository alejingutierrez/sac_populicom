import { DataTable, SectionHeading, StatCard, StatusBadge } from "@sac/ui";

import { DashboardShell } from "@/components/dashboard-shell";
import { formatDateTime, getServerRuntime, toneFromStatus } from "@/lib/server";

const OperacionPage = async () => {
  const { repository, session } = await getServerRuntime();
  const [summary, alerts, cases] = await Promise.all([
    repository.getDashboardSummary(session),
    repository.listAlerts(session),
    repository.listCases(session)
  ]);

  return (
    <DashboardShell
      activePath="/operacion"
      session={session}
      title="Centro de monitoreo"
      subtitle="Supervisión operativa de menciones, alertas y casos por agencia."
    >
      <section className="stats-grid">
        <StatCard
          detail="Cobertura de Brandwatch"
          label="Menciones 24h"
          value={String(summary.mentionsLast24h)}
        />
        <StatCard
          detail="In-app + email"
          label="Alertas abiertas"
          tone="critical"
          value={String(summary.openAlerts)}
        />
        <StatCard
          detail="Con asignación y prioridad"
          label="Casos activos"
          value={String(summary.openCases)}
        />
        <StatCard
          detail="Scoping lógico activo"
          label="Agencias cubiertas"
          tone="positive"
          value={String(summary.agenciesCovered)}
        />
      </section>

      <section className="panel-grid">
        <section className="panel">
          <SectionHeading
            description="Severidad, estado y tiempo de creación."
            title="Alertas recientes"
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
            description="Triage reciente y asignación."
            title="Casos activos"
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

export default OperacionPage;
