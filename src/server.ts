import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { IntervalsOperations } from "./operations.js";
export type { IntervalsOperations } from "./operations.js";
import {
  optionalAthleteId,
  requiredDate,
  readOnlyAnnotations,
  runTool,
} from "./tool-shared.js";
import { registerEventTools } from "./event-tools.js";
import { registerWorkoutTools } from "./workout-tools.js";
import { registerDiscoveryTools } from "./discovery-tools.js";
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

export function createIntervalsServer(client: IntervalsOperations): McpServer {
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

  registerEventTools(server, client.events);
  registerWorkoutTools(server, client.workouts);
  registerDiscoveryTools(server, client);
  return server;
}
