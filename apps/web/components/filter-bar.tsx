"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterField = {
  name: string;
  label: string;
  type: "search" | "select" | "date";
  options?: Array<{ label: string; value: string }>;
};

type FilterBarProps = {
  fields: FilterField[];
  initialValues: Record<string, string>;
  storageKey: string;
};

const buildQueryString = (values: Record<string, string>) => {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
};

export const FilterBar = ({ fields, initialValues, storageKey }: FilterBarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    const hasParams = searchParams.size > 0;
    if (hasParams) {
      window.localStorage.setItem(storageKey, JSON.stringify(values));
      return;
    }

    const persisted = window.localStorage.getItem(storageKey);
    if (!persisted) {
      return;
    }

    const nextValues = JSON.parse(persisted) as Record<string, string>;

    startTransition(() => {
      const query = buildQueryString(nextValues);
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }, [pathname, router, searchParams, storageKey, values]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = buildQueryString(values);

    window.localStorage.setItem(storageKey, JSON.stringify(values));
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  const clear = () => {
    const resetValues = Object.fromEntries(Object.keys(values).map((key) => [key, ""])) as Record<string, string>;
    setValues(resetValues);
    window.localStorage.removeItem(storageKey);

    startTransition(() => {
      router.replace(pathname);
    });
  };

  return (
    <form className="filter-bar" onSubmit={onSubmit}>
      {fields.map((field) => (
        <label className="filter-bar__field" htmlFor={field.name} key={field.name}>
          <span>{field.label}</span>
          {field.type === "select" ? (
            <select
              id={field.name}
              name={field.name}
              value={values[field.name] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            >
              <option value="">Todos</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.name}
              name={field.name}
              type={field.type === "search" ? "search" : "date"}
              value={values[field.name] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          )}
        </label>
      ))}
      <div className="filter-bar__actions">
        <button className="button button--primary" type="submit">
          Aplicar
        </button>
        <button className="button button--ghost" onClick={clear} type="button">
          Limpiar
        </button>
      </div>
    </form>
  );
};
