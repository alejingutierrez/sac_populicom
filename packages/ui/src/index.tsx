import type { PropsWithChildren, ReactNode } from "react";

type NavigationItem = {
  href: string;
  label: string;
  isActive?: boolean;
  meta?: string;
};

type AppShellProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  navigation: NavigationItem[];
  asideFooter?: ReactNode;
  toolbar?: ReactNode;
}>;

type StatCardProps = {
  label: string;
  value: string;
  tone?: "default" | "critical" | "positive";
  detail?: string;
};

type SectionHeadingProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

type StatusBadgeProps = {
  label: string;
  tone?: "default" | "critical" | "warning" | "positive" | "info";
};

type DataTableProps = {
  headers: string[];
  rows: ReactNode[][];
};

export const AppShell = ({ asideFooter, children, eyebrow, navigation, subtitle, title, toolbar }: AppShellProps) => (
  <div className="app-shell">
    <aside className="app-shell__sidebar">
      <div className="app-shell__brand">
        <span className="app-shell__eyebrow">{eyebrow}</span>
        <h1 className="app-shell__brand-title">SAC Populicom</h1>
        <p className="app-shell__brand-copy">Monitoreo multiagencia para operación pública, alertas y triage.</p>
      </div>
      <nav className="app-shell__nav" aria-label="Principal">
        {navigation.map((item) => (
          <a className={`app-shell__nav-item ${item.isActive ? "is-active" : ""}`} href={item.href} key={item.href}>
            <span>{item.label}</span>
            {item.meta ? <small>{item.meta}</small> : null}
          </a>
        ))}
      </nav>
      {asideFooter ? <div className="app-shell__footer">{asideFooter}</div> : null}
    </aside>
    <main className="app-shell__main">
      <header className="app-shell__header">
        <div>
          <span className="app-shell__eyebrow">{eyebrow}</span>
          <h2 className="app-shell__page-title">{title}</h2>
          <p className="app-shell__page-copy">{subtitle}</p>
        </div>
        {toolbar ? <div className="app-shell__toolbar">{toolbar}</div> : null}
      </header>
      <div className="app-shell__content">{children}</div>
    </main>
  </div>
);

export const StatCard = ({ detail, label, tone = "default", value }: StatCardProps) => (
  <article className={`stat-card stat-card--${tone}`}>
    <span className="stat-card__label">{label}</span>
    <strong className="stat-card__value">{value}</strong>
    {detail ? <p className="stat-card__detail">{detail}</p> : null}
  </article>
);

export const SectionHeading = ({ actions, description, title }: SectionHeadingProps) => (
  <div className="section-heading">
    <div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
    {actions ? <div className="section-heading__actions">{actions}</div> : null}
  </div>
);

export const StatusBadge = ({ label, tone = "default" }: StatusBadgeProps) => (
  <span className={`status-badge status-badge--${tone}`}>{label}</span>
);

export const DataTable = ({ headers, rows }: DataTableProps) => (
  <div className="data-table">
    <table>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`row-${index}`}>
            {row.map((cell, cellIndex) => (
              <td key={`cell-${index}-${cellIndex}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const EmptyState = ({ children }: PropsWithChildren) => <div className="empty-state">{children}</div>;
