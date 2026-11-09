import type { WorkoutWriteInput } from "@bradyap/intervals-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { IntervalsOperations } from "./operations.js";
import {
  athleteInput,
  optionalAthleteId,
  resourceId,
  readOnlyAnnotations,
  createAnnotations,
  overwriteAnnotations,
  runTool,
} from "./tool-shared.js";

const workoutInput = z.strictObject({
  name: z.string().nullable().optional().describe("Workout name"),
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
  folder_id: resourceId
    .nullable()
    .optional()
    .describe("Workout library folder ID from folders_list"),
});
const idInput = z.strictObject({
  athleteId: optionalAthleteId,
  workoutId: resourceId.describe("Intervals workout ID (string or number)"),
});
const createInput = z.strictObject({
  athleteId: optionalAthleteId,
  workout: workoutInput.describe("Fields to send to the API"),
});
const updateInput = idInput.extend({
  workout: workoutInput.describe(
    "Fields to send to the API; null is forwarded explicitly. Omission behavior is API-specific",
  ),
});

export function registerWorkoutTools(
  server: McpServer,
  client: IntervalsOperations["workouts"],
): void {
  server.registerTool(
    "workouts_list",
    {
      annotations: readOnlyAnnotations,
      description:
        "List reusable workout-library entries; these are not scheduled calendar events.",
      inputSchema: athleteInput,
    },
    async (options, extra) =>
      runTool(() => client.list({ ...options, signal: extra.signal })),
  );
  server.registerTool(
    "workout_get",
    {
      annotations: readOnlyAnnotations,
      description: "Get one reusable workout-library entry by ID.",
      inputSchema: idInput,
    },
    async ({ workoutId, ...options }, extra) =>
      runTool(() =>
        client.get(workoutId, { ...options, signal: extra.signal }),
      ),
  );
  server.registerTool(
    "workout_create",
    {
      annotations: createAnnotations,
      description:
        "Create a reusable workout-library entry. This does not schedule it on the calendar; creation is not idempotent.",
      inputSchema: createInput,
    },
    async ({ workout, ...options }, extra) =>
      runTool(
        () =>
          client.create(workout satisfies WorkoutWriteInput, {
            ...options,
            signal: extra.signal,
          }),
        true,
      ),
  );
  server.registerTool(
    "workout_update",
    {
      annotations: overwriteAnnotations,
      description:
        "Update a library workout; fields can be overwritten. Omitted-field behavior is determined by this API operation; inspect the result.",
      inputSchema: updateInput,
    },
    async ({ workoutId, workout, ...options }, extra) =>
      runTool(
        () =>
          client.update(workoutId, workout satisfies WorkoutWriteInput, {
            ...options,
            signal: extra.signal,
          }),
        true,
      ),
  );
  server.registerTool(
    "workout_delete",
    {
      annotations: overwriteAnnotations,
      description: "Delete one reusable library workout by ID.",
      inputSchema: idInput,
    },
    async ({ workoutId, ...options }, extra) =>
      runTool(
        () => client.delete(workoutId, { ...options, signal: extra.signal }),
        true,
      ),
  );
}
