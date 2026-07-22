import { describe, expect, it } from "vitest";
import { resolveIntervalsAuth } from "../src/runtime.js";

describe("Intervals MCP runtime configuration", () => {
  it("selects exactly one supported authentication mode", () => {
    expect(
      resolveIntervalsAuth({ INTERVALS_API_KEY: "api-key-sentinel" }),
    ).toEqual({
      apiKey: "api-key-sentinel",
      kind: "apiKey",
    });
    expect(
      resolveIntervalsAuth({ INTERVALS_ACCESS_TOKEN: "access-token-sentinel" }),
    ).toEqual({
      accessToken: "access-token-sentinel",
      kind: "bearer",
    });
  });

  it("rejects missing or ambiguous credentials without retaining their values", () => {
    const marker = "private-marker";

    for (const environment of [
      {},
      {
        INTERVALS_ACCESS_TOKEN: `access-${marker}`,
        INTERVALS_API_KEY: `key-${marker}`,
      },
    ]) {
      let error: unknown;

      try {
        resolveIntervalsAuth(environment);
      } catch (cause) {
        error = cause;
      }

      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(marker);
      expect(JSON.stringify(error)).not.toContain(marker);
    }
  });
});
