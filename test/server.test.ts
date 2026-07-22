import {
  IntervalsAbortError,
  IntervalsConfigurationError,
  IntervalsError,
  IntervalsHttpError,
  IntervalsNetworkError,
  IntervalsRequestError,
  IntervalsResponseError,
} from "@bradyap/intervals-client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { createIntervalsServer, type IntervalsReader } from "../src/server.js";

const toolNames = [
  "athlete_get",
  "activities_list",
  "activity_get",
  "wellness_list",
  "events_list",
] as const;

describe("Intervals MCP tools", () => {
  it("lists exactly five read-only tools", async () => {
    const connection = await connect(createReader());

    try {
      const { tools } = await connection.client.listTools();

      expect(tools.map(({ name }) => name)).toEqual(toolNames);
      for (const tool of tools) {
        expect(tool.annotations).toEqual({
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
          readOnlyHint: true,
        });
      }
    } finally {
      await connection.close();
    }
  });

  it("forwards tool arguments and request signals to the matching client methods", async () => {
    const athleteGet = vi
      .fn<IntervalsReader["athlete"]["get"]>()
      .mockResolvedValue({ id: "athlete-synthetic", API_Field: "preserved" });
    const activitiesList = vi
      .fn<IntervalsReader["activities"]["list"]>()
      .mockResolvedValue([{ id: "activity-list-synthetic" }]);
    const activityGet = vi
      .fn<IntervalsReader["activities"]["get"]>()
      .mockResolvedValue({ id: "activity-detail-synthetic" });
    const wellnessList = vi
      .fn<IntervalsReader["wellness"]["list"]>()
      .mockResolvedValue([{ id: "2000-01-01" }]);
    const eventsList = vi
      .fn<IntervalsReader["events"]["list"]>()
      .mockResolvedValue([{ id: "event-synthetic" }]);
    const connection = await connect({
      activities: { get: activityGet, list: activitiesList },
      athlete: { get: athleteGet },
      events: { list: eventsList },
      wellness: { list: wellnessList },
    });

    try {
      const athleteResult = await connection.client.callTool({
        arguments: { athleteId: "athlete-synthetic" },
        name: "athlete_get",
      });
      await connection.client.callTool({
        arguments: {
          athleteId: "athlete-synthetic",
          newest: "2000-01-31",
          oldest: "2000-01-01",
        },
        name: "activities_list",
      });
      await connection.client.callTool({
        arguments: { activityId: "activity-synthetic", intervals: true },
        name: "activity_get",
      });
      await connection.client.callTool({
        arguments: {
          athleteId: "athlete-synthetic",
          newest: "2000-01-31",
          oldest: "2000-01-01",
        },
        name: "wellness_list",
      });
      await connection.client.callTool({
        arguments: {
          athleteId: "athlete-synthetic",
          calendar_id: 7,
          category: ["WORKOUT", "NOTE"],
          newest: "2000-01-31",
          oldest: "2000-01-01",
          resolve: true,
        },
        name: "events_list",
      });

      const [athleteOptions] = athleteGet.mock.calls[0] ?? [];
      const [activitiesOptions] = activitiesList.mock.calls[0] ?? [];
      const [activityId, activityOptions] = activityGet.mock.calls[0] ?? [];
      const [wellnessOptions] = wellnessList.mock.calls[0] ?? [];
      const [eventsOptions] = eventsList.mock.calls[0] ?? [];
      const { signal: athleteSignal, ...athleteArguments } =
        athleteOptions ?? {};
      const { signal: activitiesSignal, ...activitiesArguments } =
        activitiesOptions;
      const { signal: activitySignal, ...activityArguments } =
        activityOptions ?? {};
      const { signal: wellnessSignal, ...wellnessArguments } = wellnessOptions;
      const { signal: eventsSignal, ...eventsArguments } = eventsOptions;

      expect(athleteArguments).toEqual({ athleteId: "athlete-synthetic" });
      expect(athleteSignal).toBeInstanceOf(AbortSignal);
      expect(athleteResult.content).toEqual([
        {
          text: '{"id":"athlete-synthetic","API_Field":"preserved"}',
          type: "text",
        },
      ]);
      expect(activitiesArguments).toEqual({
        athleteId: "athlete-synthetic",
        newest: "2000-01-31",
        oldest: "2000-01-01",
      });
      expect(activitiesSignal).toBeInstanceOf(AbortSignal);
      expect(activityId).toBe("activity-synthetic");
      expect(activityArguments).toEqual({ intervals: true });
      expect(activitySignal).toBeInstanceOf(AbortSignal);
      expect(wellnessArguments).toEqual({
        athleteId: "athlete-synthetic",
        newest: "2000-01-31",
        oldest: "2000-01-01",
      });
      expect(wellnessSignal).toBeInstanceOf(AbortSignal);
      expect(eventsArguments).toEqual({
        athleteId: "athlete-synthetic",
        calendar_id: 7,
        category: ["WORKOUT", "NOTE"],
        newest: "2000-01-31",
        oldest: "2000-01-01",
        resolve: true,
      });
      expect(eventsSignal).toBeInstanceOf(AbortSignal);
    } finally {
      await connection.close();
    }
  });

  it("maps client failures to fixed tool errors without exposing diagnostics", async () => {
    const marker = "private-marker";
    let nextError: Error = new Error("not configured");
    const reader = createReader({
      athleteGet: () => Promise.reject(nextError),
    });
    const connection = await connect(reader);
    const errors: [Error, string][] = [
      [
        new IntervalsAbortError({
          cause: new Error(marker),
          method: "GET",
          url: `https://example.invalid/${marker}`,
        }),
        "Intervals request was cancelled.",
      ],
      [
        new IntervalsConfigurationError(marker, { cause: new Error(marker) }),
        "Intervals MCP server is not configured correctly.",
      ],
      [
        new IntervalsRequestError(marker, { cause: new Error(marker) }),
        "Intervals rejected the tool arguments.",
      ],
      [
        new IntervalsNetworkError({
          cause: new Error(marker),
          method: "GET",
          url: `https://example.invalid/${marker}`,
        }),
        "Intervals service is unavailable.",
      ],
      [
        new IntervalsHttpError({
          body: marker,
          headers: { "x-private": marker },
          method: "GET",
          status: 500,
          statusText: marker,
          url: `https://example.invalid/${marker}`,
        }),
        "Intervals service returned an HTTP error.",
      ],
      [
        new IntervalsResponseError({
          body: marker,
          cause: new Error(marker),
          message: marker,
          url: `https://example.invalid/${marker}`,
        }),
        "Intervals returned an unexpected response.",
      ],
      [
        new IntervalsError(marker, { cause: new Error(marker) }),
        "Intervals request failed.",
      ],
      [
        new Error(marker, { cause: new Error(marker) }),
        "Tool execution failed.",
      ],
    ];

    try {
      for (const [error, expectedMessage] of errors) {
        nextError = error;
        const result = await connection.client.callTool({
          arguments: {},
          name: "athlete_get",
        });
        const serialized = JSON.stringify(result);

        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: expectedMessage },
        ]);
        expect(serialized).not.toContain(marker);
        expect(serialized).not.toMatch(
          /\b(body|cause|headers|statusText|url)\b/u,
        );
      }
    } finally {
      await connection.close();
    }
  });

  it("rejects malformed arguments before invoking a client method", async () => {
    const activityGet = vi
      .fn<IntervalsReader["activities"]["get"]>()
      .mockResolvedValue({ id: "unexpected" });
    const reader = createReader({ activityGet });
    const connection = await connect(reader);

    try {
      const result = await connection.client.callTool({
        arguments: { activityId: 42 },
        name: "activity_get",
      });

      expect(result.isError).toBe(true);
      expect(activityGet).not.toHaveBeenCalled();
    } finally {
      await connection.close();
    }
  });

  it("forwards SDK request cancellation through the installed handler signal", async () => {
    let forwardedSignal: AbortSignal | undefined;
    let markEntered: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    const reader = createReader({
      activitiesList: async (options) => {
        forwardedSignal = options.signal;
        markEntered?.();

        await new Promise<void>((resolve) => {
          if (options.signal?.aborted) {
            resolve();
            return;
          }

          options.signal?.addEventListener(
            "abort",
            () => {
              resolve();
            },
            { once: true },
          );
        });

        throw new IntervalsAbortError({
          cause: new Error("cancelled"),
          method: "GET",
          url: "https://example.invalid/cancelled",
        });
      },
    });
    const connection = await connect(reader);
    const controller = new AbortController();

    try {
      const outcome = connection.client
        .callTool(
          {
            arguments: { newest: "2000-01-31", oldest: "2000-01-01" },
            name: "activities_list",
          },
          CallToolResultSchema,
          { signal: controller.signal },
        )
        .then(
          () => "resolved",
          () => "rejected",
        );

      await entered;
      expect(forwardedSignal).toBeInstanceOf(AbortSignal);
      expect(forwardedSignal?.aborted).toBe(false);

      controller.abort();

      expect(await outcome).toBe("rejected");
      await vi.waitFor(() => {
        expect(forwardedSignal?.aborted).toBe(true);
      });
    } finally {
      await connection.close();
    }
  });
});

interface ReaderOverrides {
  readonly activitiesList?: IntervalsReader["activities"]["list"];
  readonly activityGet?: IntervalsReader["activities"]["get"];
  readonly athleteGet?: IntervalsReader["athlete"]["get"];
  readonly eventsList?: IntervalsReader["events"]["list"];
  readonly wellnessList?: IntervalsReader["wellness"]["list"];
}

function createReader(overrides: ReaderOverrides = {}): IntervalsReader {
  return {
    activities: {
      get:
        overrides.activityGet ??
        (() => Promise.resolve({ id: "activity-synthetic" })),
      list:
        overrides.activitiesList ??
        (() => Promise.resolve([{ id: "activity-synthetic" }])),
    },
    athlete: {
      get:
        overrides.athleteGet ??
        (() => Promise.resolve({ id: "athlete-synthetic" })),
    },
    events: {
      list:
        overrides.eventsList ??
        (() => Promise.resolve([{ id: "event-synthetic" }])),
    },
    wellness: {
      list:
        overrides.wellnessList ??
        (() => Promise.resolve([{ id: "2000-01-01" }])),
    },
  };
}

async function connect(reader: IntervalsReader): Promise<{
  readonly client: Client;
  close(): Promise<void>;
}> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createIntervalsServer(reader);
  const client = new Client({ name: "intervals-mcp-test", version: "0.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}
