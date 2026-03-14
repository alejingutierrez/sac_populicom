export type UserRole = "admin" | "analista" | "lector";

export type SessionContext = {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  agencyIds: string[];
  activeAgencyId: string;
  identityProvider: "demo" | "cognito";
};

const roleCapabilities: Record<UserRole, { cases: boolean; alerts: boolean; admin: boolean }> = {
  admin: { cases: true, alerts: true, admin: true },
  analista: { cases: true, alerts: true, admin: false },
  lector: { cases: false, alerts: false, admin: false }
};

export const canViewAgency = (session: SessionContext, agencyId: string) =>
  session.role === "admin" || session.agencyIds.includes(agencyId);

export const canManageCases = (session: SessionContext, agencyId: string) =>
  roleCapabilities[session.role].cases && canViewAgency(session, agencyId);

export const canAcknowledgeAlerts = (session: SessionContext, agencyId: string) =>
  roleCapabilities[session.role].alerts && canViewAgency(session, agencyId);

export const canAdminister = (session: SessionContext) => roleCapabilities[session.role].admin;

export const scopeAgencyIds = (session: SessionContext, agencyIds: string[]) =>
  session.role === "admin" ? agencyIds : agencyIds.filter((agencyId) => session.agencyIds.includes(agencyId));

export const requireAgencyAccess = (session: SessionContext, agencyId: string) => {
  if (!canViewAgency(session, agencyId)) {
    throw new Error(`Access denied for agency ${agencyId}`);
  }
};

export const getDemoSession = (headers?: Headers): SessionContext => {
  const roleHeader = headers?.get("x-demo-role");
  const agencyHeader = headers?.get("x-demo-agencies");
  const activeAgencyHeader = headers?.get("x-demo-agency");

  const role = roleHeader === "admin" || roleHeader === "analista" || roleHeader === "lector" ? roleHeader : "admin";
  const agencyIds = agencyHeader?.split(",").map((value) => value.trim()).filter(Boolean) ?? ["pr-central", "pr-emergency"];
  const activeAgencyId = activeAgencyHeader && agencyIds.includes(activeAgencyHeader) ? activeAgencyHeader : agencyIds[0];

  return {
    userId: headers?.get("x-demo-user-id") ?? "demo-admin",
    email: headers?.get("x-demo-email") ?? "ops@sac.populicom.pr",
    displayName: headers?.get("x-demo-name") ?? "Centro de Monitoreo",
    role,
    agencyIds,
    activeAgencyId,
    identityProvider: headers?.get("x-cognito-sub") ? "cognito" : "demo"
  };
};
