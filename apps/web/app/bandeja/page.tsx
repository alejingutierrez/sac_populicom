import { SectionHeading, StatusBadge } from "@sac/ui";

import { CaseComposer } from "@/components/case-composer";
import { CaseEditor } from "@/components/case-editor";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatDateTime, getServerRuntime, resolveSearchParams, toneFromStatus } from "@/lib/server";

type BandejaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const BandejaPage = async ({ searchParams }: BandejaPageProps) => {
  const { repository, session } = await getServerRuntime();
  const params = await resolveSearchParams(searchParams);
  const selectedAgencyId = typeof params.agencyId === "string" ? params.agencyId : session.activeAgencyId;
  const selectedMentionId = typeof params.mentionId === "string" ? params.mentionId : undefined;
  const cases = repository.listCases(session, selectedAgencyId);
  const mentions = repository.listMentions(session, { agencyId: selectedAgencyId });
  const agencies = repository.listAgencies(session);
  const users = repository.listUsers(session);

  return (
    <DashboardShell
      activePath="/bandeja"
      session={session}
      title="Bandeja SAC"
      subtitle="Triage humano, asignación y seguimiento de casos."
    >
      <section className="panel-grid">
        <CaseComposer
          agencyOptions={agencies.map((agency) => ({ label: agency.name, value: agency.id }))}
          mentionOptions={mentions.map((mention) => ({
            label: `${mention.channel} · ${mention.title ?? mention.body.slice(0, 40)}`,
            value: mention.id
          }))}
          preselectedAgencyId={selectedAgencyId}
          preselectedMentionId={selectedMentionId}
        />

        <section className="panel">
          <SectionHeading title={`Casos activos en ${selectedAgencyId}`} description="Actualiza estado, prioridad y responsable." />
          <div className="stack">
            {cases.map((record) => (
              <article className="case-card" key={record.id}>
                <div className="case-card__header">
                  <div>
                    <h4>{record.title}</h4>
                    <p>{record.summary}</p>
                  </div>
                  <div className="toolbar-stack">
                    <StatusBadge label={record.status} tone={toneFromStatus(record.status)} />
                    <StatusBadge label={record.priority} tone={toneFromStatus(record.priority)} />
                  </div>
                </div>
                <small>Actualizado {formatDateTime(record.updatedAt)}</small>
                <CaseEditor
                  caseId={record.id}
                  assignedToId={record.assignedToId}
                  priority={record.priority}
                  status={record.status}
                  userOptions={users.map((user) => ({ label: user.displayName, value: user.id }))}
                />
              </article>
            ))}
          </div>
        </section>
      </section>
    </DashboardShell>
  );
};

export default BandejaPage;
