import { describe, expect, it } from "vitest";

import { canAdminister, canManageCases, canViewAgency, getDemoSession, scopeAgencyIds } from "./index";

describe("auth rbac", () => {
  it("allows admins to administer and view any agency", () => {
    const session = getDemoSession(
      new Headers({
        "x-demo-role": "admin",
        "x-demo-agencies": "pr-central"
      })
    );

    expect(canAdminister(session)).toBe(true);
    expect(canManageCases(session, "agency-x")).toBe(true);
    expect(canViewAgency(session, "agency-y")).toBe(true);
  });

  it("limits analysts to their agencies", () => {
    const session = getDemoSession(
      new Headers({
        "x-demo-role": "analista",
        "x-demo-agencies": "pr-central,pr-emergency"
      })
    );

    expect(canManageCases(session, "pr-central")).toBe(true);
    expect(canViewAgency(session, "pr-emergency")).toBe(true);
    expect(scopeAgencyIds(session, ["pr-central", "agency-z"])).toEqual(["pr-central"]);
  });

  it("prevents readers from mutating cases", () => {
    const session = getDemoSession(
      new Headers({
        "x-demo-role": "lector",
        "x-demo-agencies": "pr-central"
      })
    );

    expect(canManageCases(session, "pr-central")).toBe(false);
  });
});
