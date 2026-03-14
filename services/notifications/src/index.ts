import { loadConfig } from "@sac/config";
import { getRepository, type Alert, type AlertDelivery, type User } from "@sac/db";

export const buildAlertRecipients = (alert: Alert, users: User[]) =>
  users.filter((user) => user.role !== "lector" && user.agencyIds.includes(alert.agencyId));

export const dispatchAlert = (alert: Alert, users: User[]): AlertDelivery[] => {
  const config = loadConfig();
  const timestamp = new Date().toISOString();
  const recipients = buildAlertRecipients(alert, users);

  return recipients.flatMap((user) => [
    {
      id: `delivery-${crypto.randomUUID()}`,
      alertId: alert.id,
      channel: "in_app",
      recipient: user.displayName,
      status: "sent",
      deliveredAt: timestamp
    },
    {
      id: `delivery-${crypto.randomUUID()}`,
      alertId: alert.id,
      channel: "email",
      recipient: `${user.email}|from:${config.ALERTS_FROM_EMAIL}`,
      status: "sent",
      deliveredAt: timestamp
    }
  ]);
};

export const dispatchOpenAlerts = () => {
  const repository = getRepository();
  const users = repository.state.users;
  const alerts = repository.state.alerts.filter((alert) => alert.status === "open");

  return alerts.flatMap((alert) => dispatchAlert(alert, users));
};
