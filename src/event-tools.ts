import type { CalendarEventWriteInput } from "@bradyap/intervals-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { IntervalsOperations } from "./operations.js";
import {
  optionalAthleteId,
  resourceId,
  readOnlyAnnotations,
  createAnnotations,
  overwriteAnnotations,
  runTool,
} from "./tool-shared.js";

const eventInput = z.strictObject({
  name: z.string().nullable().optional().describe("Event name"),
  description: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Description; structured workouts use native Intervals.icu workout-builder text",
    ),
  type: z
    .string()
    .nullable()
    .optional()
    .describe("Sport/activity type, e.g. Ride"),
  calendar_id: resourceId
    .nullable()
    .optional()
    .describe("Calendar ID from calendars_list"),
  category: z
    .string()
    .nullable()
    .optional()
    .describe("Calendar event category, e.g. WORKOUT, RACE or NOTE"),
  start_date_local: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Local calendar date/time YYYY-MM-DDTHH:mm:ss, without UTC conversion or timezone suffix",
    ),
  end_date_local: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Local end date/time YYYY-MM-DDTHH:mm:ss, without timezone suffix",
    ),
});
const idInput = z.strictObject({
  athleteId: optionalAthleteId,
  eventId: resourceId.describe("Intervals event ID (string or number)"),
});
const createInput = z.strictObject({
  athleteId: optionalAthleteId,
  event: eventInput.describe("Fields to send to the API"),
});
const updateInput = idInput.extend({
  event: eventInput.describe(
    "Fields to send to the API; null is forwarded explicitly. Omission behavior is API-specific",
  ),
});

export function registerEventTools(
  server: McpServer,
  client: IntervalsOperations["events"],
): void {
  server.registerTool(
    "event_get",
    {
      annotations: readOnlyAnnotations,
      description: "Get one scheduled calendar event by ID.",
      inputSchema: idInput,
    },
    async ({ eventId, ...options }, extra) =>
      runTool(() => client.get(eventId, { ...options, signal: extra.signal })),
  );
  server.registerTool(
    "event_create",
    {
      annotations: createAnnotations,
      description:
        "Create a scheduled calendar event; this is not an idempotent operation.",
      inputSchema: createInput,
    },
    async ({ event, ...options }, extra) =>
      runTool(
        () =>
          client.create(event satisfies CalendarEventWriteInput, {
            ...options,
            signal: extra.signal,
          }),
        true,
      ),
  );
  server.registerTool(
    "event_update",
    {
      annotations: overwriteAnnotations,
      description:
        "Update a calendar event; fields can be overwritten. Omitted-field behavior is determined by this API operation; inspect the result.",
      inputSchema: updateInput,
    },
    async ({ eventId, event, ...options }, extra) =>
      runTool(
        () =>
          client.update(eventId, event satisfies CalendarEventWriteInput, {
            ...options,
            signal: extra.signal,
          }),
        true,
      ),
  );
  server.registerTool(
    "event_delete",
    {
      annotations: overwriteAnnotations,
      description: "Delete one calendar event by ID.",
      inputSchema: idInput,
    },
    async ({ eventId, ...options }, extra) =>
      runTool(async () => {
        await client.delete(eventId, { ...options, signal: extra.signal });
        return { deleted: true, eventId };
      }, true),
  );
}
