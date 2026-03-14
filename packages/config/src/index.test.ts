import { describe, expect, it } from "vitest";

import { getPublicConfig, loadConfig } from "./index";

describe("config", () => {
  it("loads defaults for local development", () => {
    const config = loadConfig({});

    expect(config.AWS_REGION).toBe("us-east-1");
    expect(config.DEFAULT_TIME_ZONE).toBe("America/Puerto_Rico");
    expect(config.NEXT_PUBLIC_APP_NAME).toBe("SAC Populicom");
  });

  it("exposes a reduced public config shape", () => {
    const publicConfig = getPublicConfig({
      NEXT_PUBLIC_APP_NAME: "SAC PR",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_DEFAULT_AGENCY_ID: "pr-central",
      DEFAULT_LOCALE: "es-PR",
      DEFAULT_TIME_ZONE: "America/Puerto_Rico"
    });

    expect(publicConfig.appName).toBe("SAC PR");
    expect(publicConfig.defaultAgencyId).toBe("pr-central");
  });
});
