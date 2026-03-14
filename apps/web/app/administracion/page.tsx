import { DataTable, SectionHeading, StatusBadge } from "@sac/ui";

import { DashboardShell } from "@/components/dashboard-shell";
import { getServerRuntime } from "@/lib/server";

const AdministrationPage = async () => {
  const { config, repository, session } = await getServerRuntime();
  const agencies = repository.listAgencies(session);
  const users = repository.listUsers(session);
  const filters = repository.listSavedFilters(session);

  return (
    <DashboardShell
      activePath="/administracion"
      session={session}
      title="Administración"
      subtitle="Catálogo base de agencias, usuarios y parámetros de despliegue."
    >
      <section className="panel-grid">
        <section className="panel">
          <SectionHeading title="Agencias" description="Scoping lógico para multiagencia." />
          <DataTable
            headers={["Agencia", "Slug", "Estado"]}
            rows={agencies.map((agency) => [
              agency.name,
              agency.slug,
              <StatusBadge key={agency.id} label={agency.isActive ? "activa" : "inactiva"} tone={agency.isActive ? "positive" : "warning"} />
            ])}
          />
        </section>

        <section className="panel">
          <SectionHeading title="Usuarios" description={`Filtros guardados: ${filters.length}`} />
          <DataTable
            headers={["Nombre", "Email", "Rol", "Agencias"]}
            rows={users.map((user) => [
              user.displayName,
              user.email,
              <StatusBadge key={`${user.id}-role`} label={user.role} tone={user.role === "admin" ? "critical" : "info"} />,
              user.agencyIds.join(", ")
            ])}
          />
        </section>
      </section>

      <section className="panel">
        <SectionHeading title="Runtime previsto" description="Defaults listos para AWS comercial en us-east-1." />
        <div className="definition-grid">
          <div>
            <span>App</span>
            <strong>{config.appName}</strong>
          </div>
          <div>
            <span>Base URL</span>
            <strong>{config.baseUrl}</strong>
          </div>
          <div>
            <span>Agencia default</span>
            <strong>{config.defaultAgencyId}</strong>
          </div>
          <div>
            <span>Zona horaria</span>
            <strong>{config.timeZone}</strong>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
};

export default AdministrationPage;
