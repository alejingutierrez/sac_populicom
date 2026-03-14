import { getDemoSession } from "@sac/auth";
import { loadConfig } from "@sac/config";
import {
  getRepository,
  type Alert,
  type AlertDelivery,
  type User
} from "@sac/db";

export const buildAlertRecipients = (alert: Alert, users: User[]) =>
  users.filter(
    (user) => user.role !== "lector" && user.agencyIds.includes(alert.agencyId)
  );

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

export const dispatchOpenAlerts = async () => {
  const repository = getRepository();
  await repository.ready();
  const session = getDemoSession();
  const [users, alerts] = await Promise.all([
    repository.listUsers(session),
    repository.listAlerts(session)
  ]);

  return alerts
    .filter((alert) => alert.status === "open")
    .flatMap((alert) => dispatchAlert(alert, users));
};
