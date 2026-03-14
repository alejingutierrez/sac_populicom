import { describe, expect, it } from "vitest";

import { assertCaseTransition } from "./index";

describe("case transitions", () => {
  it("accepts valid transitions", () => {
    expect(() => assertCaseTransition("new", "triaged")).not.toThrow();
    expect(() => assertCaseTransition("triaged", "in_progress")).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => assertCaseTransition("new", "in_progress")).toThrow("Invalid case transition");
  });
});
