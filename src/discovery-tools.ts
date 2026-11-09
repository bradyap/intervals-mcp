import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { IntervalsOperations } from "./operations.js";
import {
  athleteInput,
  optionalAthleteId,
  resourceId,
  readOnlyAnnotations,
  runTool,
} from "./tool-shared.js";

export function registerDiscoveryTools(
  server: McpServer,
  client: Pick<IntervalsOperations, "calendars" | "folders" | "sportSettings">,
): void {
  server.registerTool(
    "calendars_list",
    {
      annotations: readOnlyAnnotations,
      description: "List available calendars for scheduling calendar events.",
      inputSchema: athleteInput,
    },
    async (options, extra) =>
      runTool(() =>
        client.calendars.list({ ...options, signal: extra.signal }),
      ),
  );
  server.registerTool(
    "folders_list",
    {
      annotations: readOnlyAnnotations,
      description:
        "List available folders for reusable workout-library entries.",
      inputSchema: athleteInput,
    },
    async (options, extra) =>
      runTool(() => client.folders.list({ ...options, signal: extra.signal })),
  );
  server.registerTool(
    "sport_settings_list",
    {
      annotations: readOnlyAnnotations,
      description:
        "List sport settings, including available cycling thresholds and zones. Returns API fields unchanged without deriving missing values.",
      inputSchema: athleteInput,
    },
    async (options, extra) =>
      runTool(() =>
        client.sportSettings.list({ ...options, signal: extra.signal }),
      ),
  );
  server.registerTool(
    "sport_settings_get",
    {
      annotations: readOnlyAnnotations,
      description:
        "Get one sport-settings record by its settings ID from sport_settings_list; preserves thresholds, zones and other API fields unchanged.",
      inputSchema: z.strictObject({
        athleteId: optionalAthleteId,
        settingsId: resourceId.describe(
          "Sport-settings record ID (string or number)",
        ),
      }),
    },
    async ({ settingsId, ...options }, extra) =>
      runTool(() =>
        client.sportSettings.get(settingsId, {
          ...options,
          signal: extra.signal,
        }),
      ),
  );
}
