import { DataTable, SectionHeading, StatusBadge } from "@sac/ui";

import { AlertAckButton } from "@/components/alert-ack-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatDateTime, getServerRuntime, toneFromStatus } from "@/lib/server";

const AlertsPage = async () => {
  const { repository, session } = await getServerRuntime();
  const alerts = await repository.listAlerts(session);

  return (
    <DashboardShell
      activePath="/alerts"
      session={session}
      title="Alertas"
      subtitle="Eventos críticos, palabras clave sensibles y picos operativos."
    >
      <section className="panel">
        <SectionHeading
          title={`Alertas abiertas y resueltas (${alerts.length})`}
        />
        <DataTable
          headers={["Título", "Severidad", "Estado", "Creada", "Acción"]}
          rows={alerts.map((alert) => [
            <div key={`${alert.id}-title`}>
              <strong>{alert.title}</strong>
              <p>{alert.description}</p>
            </div>,
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
            formatDateTime(alert.createdAt),
            alert.status === "open" ? (
              <AlertAckButton alertId={alert.id} key={`${alert.id}-ack`} />
            ) : (
              "Registrada"
            )
          ])}
        />
      </section>
    </DashboardShell>
  );
};

export default AlertsPage;
