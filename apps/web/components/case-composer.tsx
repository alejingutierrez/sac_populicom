"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Option = {
  label: string;
  value: string;
};

type CaseComposerProps = {
  agencyOptions: Option[];
  mentionOptions: Option[];
  preselectedAgencyId?: string;
  preselectedMentionId?: string;
};

export const CaseComposer = ({
  agencyOptions,
  mentionOptions,
  preselectedAgencyId,
  preselectedMentionId
}: CaseComposerProps) => {
  const router = useRouter();
  const [form, setForm] = useState({
    agencyId: preselectedAgencyId ?? agencyOptions[0]?.value ?? "",
    mentionId: preselectedMentionId ?? "",
    title: "",
    summary: "",
    priority: "high"
  });
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setBusy(false);
      return;
    }

    setForm((current) => ({
      ...current,
      title: "",
      summary: ""
    }));

    startTransition(() => {
      router.refresh();
    });
    setBusy(false);
  };

  return (
    <form className="panel case-form" onSubmit={submit}>
      <h4>Crear caso operativo</h4>
      <label>
        <span>Agencia</span>
        <select
          name="agencyId"
          value={form.agencyId}
          onChange={(event) => setForm((current) => ({ ...current, agencyId: event.target.value }))}
        >
          {agencyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Mención base</span>
        <select
          name="mentionId"
          value={form.mentionId}
          onChange={(event) => setForm((current) => ({ ...current, mentionId: event.target.value }))}
        >
          <option value="">Sin vínculo directo</option>
          {mentionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Título</span>
        <input
          name="title"
          required
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <label>
        <span>Resumen</span>
        <textarea
          name="summary"
          required
          rows={4}
          value={form.summary}
          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </label>
      <label>
        <span>Prioridad</span>
        <select
          name="priority"
          value={form.priority}
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
        >
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </label>
      <button className="button button--primary" disabled={busy} type="submit">
        {busy ? "Creando..." : "Crear caso"}
      </button>
    </form>
  );
};
