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
import {
  createIntervalsServer,
  type IntervalsOperations,
} from "../src/server.js";

const signalMatcher: unknown = expect.any(AbortSignal);

const toolNames = [
  "athlete_get",
  "activities_list",
  "activity_get",
  "wellness_list",
  "events_list",
  "event_get",
  "event_create",
  "event_update",
  "event_delete",
  "workouts_list",
  "workout_get",
  "workout_create",
  "workout_update",
  "workout_delete",
  "calendars_list",
  "folders_list",
  "sport_settings_list",
  "sport_settings_get",
] as const;

describe("Intervals MCP tools", () => {
  it("lists all tools with operation-specific annotations", async () => {
    const connection = await connect(createReader());

    try {
      const { tools } = await connection.client.listTools();

      expect(tools.map(({ name }) => name)).toEqual(toolNames);
      for (const tool of tools) {
        expect(tool.annotations).toEqual({
          destructiveHint: /_(update|delete)$/u.test(tool.name),
          idempotentHint: !/_(create|update|delete)$/u.test(tool.name),
          openWorldHint: true,
          readOnlyHint: !/_(create|update|delete)$/u.test(tool.name),
        });
      }
    } finally {
      await connection.close();
    }
  });

  it("forwards tool arguments and request signals to the matching client methods", async () => {
    const athleteGet = vi
      .fn<IntervalsOperations["athlete"]["get"]>()
      .mockResolvedValue({ id: "athlete-synthetic", API_Field: "preserved" });
    const activitiesList = vi
      .fn<IntervalsOperations["activities"]["list"]>()
      .mockResolvedValue([{ id: "activity-list-synthetic" }]);
    const activityGet = vi
      .fn<IntervalsOperations["activities"]["get"]>()
      .mockResolvedValue({ id: "activity-detail-synthetic" });
    const wellnessList = vi
      .fn<IntervalsOperations["wellness"]["list"]>()
      .mockResolvedValue([{ id: "2000-01-01" }]);
    const eventsList = vi
      .fn<IntervalsOperations["events"]["list"]>()
      .mockResolvedValue([{ id: "event-synthetic" }]);
    const connection = await connect({
      ...createReader(),
      activities: { get: activityGet, list: activitiesList },
      athlete: { get: athleteGet },
      events: { ...createReader().events, list: eventsList },
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

  it("forwards every added operation and preserves client results", async () => {
    const reader = createReader();
    const event = {
      name: "Ride",
      description: "- 10m 60%",
      type: "Ride",
      calendar_id: "7",
      category: "WORKOUT",
      start_date_local: "2026-11-10T09:00:00",
      end_date_local: null,
    };
    const workout = {
      name: "Reusable",
      description: "- 10m 60%",
      type: "Ride",
      folder_id: 8,
    };
    const cases = [
      {
        name: "event_get",
        args: { eventId: "1", athleteId: "other" },
        method: reader.events.get,
        forwarded: ["1"],
        options: { athleteId: "other" },
        result: { id: 1 },
      },
      {
        name: "event_create",
        args: { event, athleteId: "other" },
        method: reader.events.create,
        forwarded: [event],
        options: { athleteId: "other" },
        result: { id: 1 },
      },
      {
        name: "event_update",
        args: { eventId: 1, event: { name: null, calendar_id: null } },
        method: reader.events.update,
        forwarded: [1, { name: null, calendar_id: null }],
        options: {},
        result: { id: 1 },
      },
      {
        name: "event_delete",
        args: { eventId: "1" },
        method: reader.events.delete,
        forwarded: ["1"],
        options: {},
        result: { deleted: true, eventId: "1" },
      },
      {
        name: "workouts_list",
        args: { athleteId: "other" },
        method: reader.workouts.list,
        forwarded: [],
        options: { athleteId: "other" },
        result: [{ id: 2 }],
      },
      {
        name: "workout_get",
        args: { workoutId: 2 },
        method: reader.workouts.get,
        forwarded: [2],
        options: {},
        result: { id: 2 },
      },
      {
        name: "workout_create",
        args: { workout, athleteId: "other" },
        method: reader.workouts.create,
        forwarded: [workout],
        options: { athleteId: "other" },
        result: { id: 2 },
      },
      {
        name: "workout_update",
        args: {
          workoutId: "2",
          workout: { description: null, folder_id: null },
        },
        method: reader.workouts.update,
        forwarded: ["2", { description: null, folder_id: null }],
        options: {},
        result: { id: 2 },
      },
      {
        name: "workout_delete",
        args: { workoutId: 2, athleteId: "other" },
        method: reader.workouts.delete,
        forwarded: [2],
        options: { athleteId: "other" },
        result: [2, 4],
      },
      {
        name: "calendars_list",
        args: {},
        method: reader.calendars.list,
        forwarded: [],
        options: {},
        result: [{ id: 1, name: "Calendar" }],
      },
      {
        name: "folders_list",
        args: { athleteId: "other" },
        method: reader.folders.list,
        forwarded: [],
        options: { athleteId: "other" },
        result: [{ id: "folder", name: "Library" }],
      },
      {
        name: "sport_settings_list",
        args: {},
        method: reader.sportSettings.list,
        forwarded: [],
        options: {},
        result: [
          { id: 3, ftp: 250, power_zones: [55, 75], unknown_field: null },
        ],
      },
      {
        name: "sport_settings_get",
        args: { settingsId: "3", athleteId: "other" },
        method: reader.sportSettings.get,
        forwarded: ["3"],
        options: { athleteId: "other" },
        result: { id: 3, ftp: 250, power_zones: [55, 75], unknown_field: null },
      },
    ];
    const connection = await connect(reader);
    try {
      for (const row of cases) {
        const result = await connection.client.callTool({
          name: row.name,
          arguments: row.args,
        });
        expect(result).toEqual({
          content: [{ type: "text", text: JSON.stringify(row.result) }],
        });
        expect(row.method).toHaveBeenCalledExactlyOnceWith(...row.forwarded, {
          ...row.options,
          signal: signalMatcher,
        });
      }
    } finally {
      await connection.close();
    }
  });

  it("accepts empty update payloads and both resource ID types without adapter normalization", async () => {
    const reader = createReader();
    const connection = await connect(reader);
    try {
      for (const id of [17, " 17 "]) {
        await connection.client.callTool({
          name: "event_get",
          arguments: { eventId: id },
        });
        await connection.client.callTool({
          name: "workout_get",
          arguments: { workoutId: id },
        });
        await connection.client.callTool({
          name: "sport_settings_get",
          arguments: { settingsId: id },
        });
        expect(reader.events.get).toHaveBeenLastCalledWith(id, {
          signal: signalMatcher,
        });
        expect(reader.workouts.get).toHaveBeenLastCalledWith(id, {
          signal: signalMatcher,
        });
        expect(reader.sportSettings.get).toHaveBeenLastCalledWith(id, {
          signal: signalMatcher,
        });
      }
      await connection.client.callTool({
        name: "event_update",
        arguments: { eventId: 1, event: {} },
      });
      await connection.client.callTool({
        name: "workout_update",
        arguments: { workoutId: 2, workout: {} },
      });
      expect(reader.events.update).toHaveBeenCalledWith(
        1,
        {},
        { signal: signalMatcher },
      );
      expect(reader.workouts.update).toHaveBeenCalledWith(
        2,
        {},
        { signal: signalMatcher },
      );
    } finally {
      await connection.close();
    }
  });

  it("rejects basic shape errors and unknown write fields before forwarding", async () => {
    const reader = createReader();
    const connection = await connect(reader);
    try {
      for (const [name, args] of [
        ["event_create", { event: { calendar_id: true } }],
        ["event_create", { event: { workout_doc: {} } }],
        ["event_create", { event: {}, upsertOnUid: true }],
        ["event_update", { eventId: 1, event: { typo: "bad" } }],
        ["event_delete", { eventId: null }],
        ["workout_create", { workout: { folder_id: [] } }],
        ["workout_update", { workoutId: 2, workout: { name: 3 } }],
        ["sport_settings_get", { settingsId: false }],
        ["folders_list", { athleteId: 3 }],
        ["calendars_list", { extra: true }],
      ] as const) {
        const result = await connection.client.callTool({
          name,
          arguments: args,
        });
        expect(result.isError).toBe(true);
      }
      for (const method of [
        reader.events.create,
        reader.events.update,
        reader.events.delete,
        reader.workouts.create,
        reader.workouts.update,
        reader.sportSettings.get,
        reader.folders.list,
        reader.calendars.list,
      ]) {
        expect(method).not.toHaveBeenCalled();
      }
    } finally {
      await connection.close();
    }
  });

  it("sanitizes uncertain write failures without claiming rollback or retrying", async () => {
    const reader = createReader();
    const connection = await connect(reader);
    const details = {
      method: "POST",
      url: "https://example.invalid/private-marker",
      cause: new Error("private-marker"),
    };
    try {
      for (const error of [
        new IntervalsAbortError(details),
        new IntervalsNetworkError(details),
        new IntervalsResponseError({
          ...details,
          message: "private-marker",
          body: "private-marker",
        }),
      ]) {
        const method = vi
          .fn<IntervalsOperations["events"]["create"]>()
          .mockRejectedValue(error);
        reader.events.create = method;
        const result = await connection.client.callTool({
          name: "event_create",
          arguments: { event: { name: "Ride" } },
        });
        expect(result).toEqual({
          isError: true,
          content: [
            {
              type: "text",
              text: "Intervals write outcome is uncertain; the operation may have been applied. Check the resource before retrying.",
            },
          ],
        });
        expect(method).toHaveBeenCalledTimes(1);
      }
    } finally {
      await connection.close();
    }
  });

  it.each([
    { write: true, status: 500, uncertain: true },
    { write: true, status: 503, uncertain: true },
    { write: true, status: 599, uncertain: true },
    { write: true, status: 400, uncertain: false },
    { write: true, status: 499, uncertain: false },
    { write: true, status: 600, uncertain: false },
    { write: false, status: 503, uncertain: false },
  ])(
    "maps HTTP $status with write=$write without diagnostics or retries",
    async ({ write, status, uncertain }) => {
      const marker = "private-marker";
      const error = new IntervalsHttpError({
        body: marker,
        headers: { authorization: marker },
        method: write ? "POST" : "GET",
        status,
        statusText: marker,
        url: `https://example.invalid/${marker}`,
      });
      const reader = createReader();
      const method = vi
        .fn<IntervalsOperations["events"]["create"]>()
        .mockRejectedValue(error);
      const readMethod = vi
        .fn<IntervalsOperations["athlete"]["get"]>()
        .mockRejectedValue(error);
      reader.events.create = method;
      reader.athlete.get = readMethod;
      const connection = await connect(reader);
      try {
        const result = await connection.client.callTool({
          name: write ? "event_create" : "athlete_get",
          arguments: write ? { event: { name: "Ride" } } : {},
        });
        expect(result).toEqual({
          isError: true,
          content: [
            {
              type: "text",
              text: uncertain
                ? "Intervals write outcome is uncertain; the operation may have been applied. Check the resource before retrying."
                : "Intervals service returned an HTTP error.",
            },
          ],
        });
        expect(JSON.stringify(result)).not.toContain(marker);
        expect(write ? method : readMethod).toHaveBeenCalledTimes(1);
        expect(write ? readMethod : method).not.toHaveBeenCalled();
      } finally {
        await connection.close();
      }
    },
  );

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
      .fn<IntervalsOperations["activities"]["get"]>()
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

  it.each(["read", "write"])(
    "forwards SDK request cancellation for a %s operation",
    async (operation) => {
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
      reader.events.create = async (_event, options = {}) => {
        await reader.activities.list({
          oldest: "2000-01-01",
          newest: "2000-01-31",
          ...options,
        });
        return { id: 1 };
      };
      const connection = await connect(reader);
      const controller = new AbortController();

      try {
        const outcome = connection.client
          .callTool(
            {
              arguments:
                operation === "read"
                  ? { newest: "2000-01-31", oldest: "2000-01-01" }
                  : { event: { name: "Ride" } },
              name: operation === "read" ? "activities_list" : "event_create",
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
    },
  );
});

interface ReaderOverrides {
  readonly activitiesList?: IntervalsOperations["activities"]["list"];
  readonly activityGet?: IntervalsOperations["activities"]["get"];
  readonly athleteGet?: IntervalsOperations["athlete"]["get"];
  readonly eventsList?: IntervalsOperations["events"]["list"];
  readonly wellnessList?: IntervalsOperations["wellness"]["list"];
}

function createReader(overrides: ReaderOverrides = {}): IntervalsOperations {
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
    calendars: {
      list: vi.fn().mockResolvedValue([{ id: 1, name: "Calendar" }]),
    },
    folders: {
      list: vi.fn().mockResolvedValue([{ id: "folder", name: "Library" }]),
    },
    sportSettings: {
      list: vi
        .fn()
        .mockResolvedValue([
          { id: 3, ftp: 250, power_zones: [55, 75], unknown_field: null },
        ]),
      get: vi.fn().mockResolvedValue({
        id: 3,
        ftp: 250,
        power_zones: [55, 75],
        unknown_field: null,
      }),
    },
    workouts: {
      list: vi.fn().mockResolvedValue([{ id: 2 }]),
      get: vi.fn().mockResolvedValue({ id: 2 }),
      create: vi.fn().mockResolvedValue({ id: 2 }),
      update: vi.fn().mockResolvedValue({ id: 2 }),
      delete: vi.fn().mockResolvedValue([2, 4]),
    },
    events: {
      get: vi.fn().mockResolvedValue({ id: 1 }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue(undefined),
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

async function connect(reader: IntervalsOperations): Promise<{
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
