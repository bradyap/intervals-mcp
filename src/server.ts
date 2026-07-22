import {
  IntervalsAbortError,
  IntervalsConfigurationError,
  IntervalsError,
  IntervalsHttpError,
  IntervalsNetworkError,
  IntervalsRequestError,
  IntervalsResponseError,
  type ActivitiesResource,
  type AthleteResource,
  type EventsResource,
  type WellnessResource,
} from "@bradyap/intervals-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

export interface IntervalsReader {
  readonly activities: Pick<ActivitiesResource, "get" | "list">;
  readonly athlete: Pick<AthleteResource, "get">;
  readonly events: Pick<EventsResource, "list">;
  readonly wellness: Pick<WellnessResource, "list">;
}

const readOnlyAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
} as const;

const optionalAthleteId = z
  .string()
  .optional()
  .describe("Intervals athlete ID; defaults to 0");
const requiredDate = z.string().describe("Calendar date in YYYY-MM-DD format");

const athleteGetInput = z.strictObject({
  athleteId: optionalAthleteId,
});

const activitiesListInput = z.strictObject({
  athleteId: optionalAthleteId,
  newest: requiredDate,
  oldest: requiredDate,
});

const activityGetInput = z.strictObject({
  activityId: z.string().describe("Intervals activity ID"),
  intervals: z.boolean().optional().describe("Include detected intervals"),
});

const wellnessListInput = z.strictObject({
  athleteId: optionalAthleteId,
  newest: requiredDate,
  oldest: requiredDate,
});

const eventsListInput = z.strictObject({
  athleteId: optionalAthleteId,
  calendar_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Calendar ID"),
  category: z.array(z.string()).optional().describe("Event categories"),
  newest: requiredDate,
  oldest: requiredDate,
  resolve: z.boolean().optional().describe("Resolve linked event data"),
});

export function createIntervalsServer(client: IntervalsReader): McpServer {
  const server = new McpServer({
    name: "@bradyap/intervals-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "athlete_get",
    {
      annotations: readOnlyAnnotations,
      description: "Get an Intervals athlete profile.",
      inputSchema: athleteGetInput,
    },
    async ({ athleteId }, extra) =>
      runTool(() =>
        client.athlete.get({
          ...(athleteId === undefined ? {} : { athleteId }),
          signal: extra.signal,
        }),
      ),
  );

  server.registerTool(
    "activities_list",
    {
      annotations: readOnlyAnnotations,
      description: "List Intervals activities in an inclusive date range.",
      inputSchema: activitiesListInput,
    },
    async ({ athleteId, newest, oldest }, extra) =>
      runTool(() =>
        client.activities.list({
          ...(athleteId === undefined ? {} : { athleteId }),
          newest,
          oldest,
          signal: extra.signal,
        }),
      ),
  );

  server.registerTool(
    "activity_get",
    {
      annotations: readOnlyAnnotations,
      description: "Get one Intervals activity by ID.",
      inputSchema: activityGetInput,
    },
    async ({ activityId, intervals }, extra) =>
      runTool(() =>
        client.activities.get(activityId, {
          ...(intervals === undefined ? {} : { intervals }),
          signal: extra.signal,
        }),
      ),
  );

  server.registerTool(
    "wellness_list",
    {
      annotations: readOnlyAnnotations,
      description:
        "List Intervals wellness records in an inclusive date range.",
      inputSchema: wellnessListInput,
    },
    async ({ athleteId, newest, oldest }, extra) =>
      runTool(() =>
        client.wellness.list({
          ...(athleteId === undefined ? {} : { athleteId }),
          newest,
          oldest,
          signal: extra.signal,
        }),
      ),
  );

  server.registerTool(
    "events_list",
    {
      annotations: readOnlyAnnotations,
      description: "List Intervals calendar events in an inclusive date range.",
      inputSchema: eventsListInput,
    },
    async (
      { athleteId, calendar_id, category, newest, oldest, resolve },
      extra,
    ) =>
      runTool(() =>
        client.events.list({
          ...(athleteId === undefined ? {} : { athleteId }),
          ...(calendar_id === undefined ? {} : { calendar_id }),
          ...(category === undefined ? {} : { category }),
          newest,
          oldest,
          ...(resolve === undefined ? {} : { resolve }),
          signal: extra.signal,
        }),
      ),
  );

  return server;
}

async function runTool(
  operation: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    const value = await operation();

    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: safeErrorMessage(error) }],
      isError: true,
    };
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof IntervalsAbortError) {
    return "Intervals request was cancelled.";
  }

  if (error instanceof IntervalsConfigurationError) {
    return "Intervals MCP server is not configured correctly.";
  }

  if (error instanceof IntervalsRequestError) {
    return "Intervals rejected the tool arguments.";
  }

  if (error instanceof IntervalsNetworkError) {
    return "Intervals service is unavailable.";
  }

  if (error instanceof IntervalsHttpError) {
    return "Intervals service returned an HTTP error.";
  }

  if (error instanceof IntervalsResponseError) {
    return "Intervals returned an unexpected response.";
  }

  if (error instanceof IntervalsError) {
    return "Intervals request failed.";
  }

  return "Tool execution failed.";
}
