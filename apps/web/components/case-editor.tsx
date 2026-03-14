"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type CaseEditorProps = {
  caseId: string;
  assignedToId?: string;
  priority: string;
  status: string;
  userOptions: Array<{ label: string; value: string }>;
};

export const CaseEditor = ({ assignedToId, caseId, priority, status, userOptions }: CaseEditorProps) => {
  const router = useRouter();
  const [form, setForm] = useState({
    status,
    priority,
    assignedToId: assignedToId ?? "",
    note: ""
  });
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    const response = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setBusy(false);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
    setBusy(false);
  };

  return (
    <form className="case-inline-editor" onSubmit={submit}>
      <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
        <option value="new">Nuevo</option>
        <option value="triaged">Triaged</option>
        <option value="in_progress">En curso</option>
        <option value="closed">Cerrado</option>
      </select>
      <select
        value={form.priority}
        onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
      >
        <option value="critical">Crítica</option>
        <option value="high">Alta</option>
        <option value="medium">Media</option>
        <option value="low">Baja</option>
      </select>
      <select
        value={form.assignedToId}
        onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}
      >
        <option value="">Sin asignar</option>
        {userOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        placeholder="Nota operativa"
        value={form.note}
        onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
      />
      <button className="button button--ghost" disabled={busy} type="submit">
        {busy ? "Guardando..." : "Actualizar"}
      </button>
    </form>
  );
};
