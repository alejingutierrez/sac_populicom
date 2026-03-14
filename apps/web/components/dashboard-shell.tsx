import type { PropsWithChildren } from "react";

import type { SessionContext } from "@sac/auth";
import { AppShell, StatusBadge } from "@sac/ui";

type DashboardShellProps = PropsWithChildren<{
  activePath: string;
  session: SessionContext;
  title: string;
  subtitle: string;
}>;

const navigationItems = [
  { href: "/", label: "Exploración" },
  { href: "/operacion", label: "Operación" },
  { href: "/mentions", label: "Menciones" },
  { href: "/alerts", label: "Alertas" },
  { href: "/bandeja", label: "Bandeja SAC" },
  { href: "/reportes", label: "Reportes" },
  { href: "/administracion", label: "Administración" }
];

export const DashboardShell = ({
  activePath,
  children,
  session,
  subtitle,
  title
}: DashboardShellProps) => (
  <AppShell
    eyebrow="Gobierno de Puerto Rico"
    title={title}
    subtitle={subtitle}
    navigation={navigationItems.map((item) => ({
      ...item,
      isActive: activePath === item.href
    }))}
    toolbar={
      <div className="toolbar-stack">
        <StatusBadge
          label={session.role.toUpperCase()}
          tone={session.role === "admin" ? "critical" : "info"}
        />
        <StatusBadge label={session.activeAgencyId} tone="default" />
      </div>
    }
    asideFooter={
      <div className="profile-card">
        <strong>{session.displayName}</strong>
        <span>{session.email}</span>
        <small>
          {session.identityProvider === "cognito" ? "Federado" : "Demo local"}
        </small>
      </div>
    }
  >
    {children}
  </AppShell>
);
