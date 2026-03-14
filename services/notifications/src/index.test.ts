import { describe, expect, it } from "vitest";

import { createSeedData } from "@sac/db";

import { buildAlertRecipients, dispatchAlert } from "./index";

describe("notifications", () => {
  it("targets admins and analysts in the same agency", () => {
    const seed = createSeedData();
    const alert = seed.alerts[0];

    expect(alert).toBeDefined();

    if (!alert) {
      throw new Error("Expected seeded alert");
    }

    const recipients = buildAlertRecipients(alert, seed.users);

    expect(recipients.map((user) => user.id)).toContain("user-admin");
    expect(recipients.map((user) => user.id)).toContain("user-analyst");
    expect(recipients.map((user) => user.id)).not.toContain("user-reader");
  });

  it("creates in-app and email deliveries", () => {
    const seed = createSeedData();
    const alert = seed.alerts[0];
    if (!alert) {
      throw new Error("Expected seeded alert");
    }

    const deliveries = dispatchAlert(alert, seed.users);

    expect(deliveries.some((delivery) => delivery.channel === "in_app")).toBe(true);
    expect(deliveries.some((delivery) => delivery.channel === "email")).toBe(true);
  });
});
