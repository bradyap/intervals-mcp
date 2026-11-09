import {
  IntervalsAbortError,
  IntervalsConfigurationError,
  IntervalsError,
  IntervalsHttpError,
  IntervalsNetworkError,
  IntervalsRequestError,
  IntervalsResponseError,
} from "@bradyap/intervals-client";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
export const readOnlyAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  readOnlyHint: true,
} as const;

export const optionalAthleteId = z
  .string()
  .optional()
  .describe(
    "Intervals athlete ID; defaults to the client-configured athlete (normally 0)",
  );
export const requiredDate = z
  .string()
  .describe("Calendar date in YYYY-MM-DD format");

export const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
export const overwriteAnnotations = {
  ...createAnnotations,
  destructiveHint: true,
};
export const resourceId = z.union([z.string(), z.number()]);
export const athleteInput = z.strictObject({ athleteId: optionalAthleteId });
export async function runTool(
  operation: () => Promise<unknown>,
  write = false,
): Promise<CallToolResult> {
  try {
    const value = await operation();

    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: safeErrorMessage(error, write) }],
      isError: true,
    };
  }
}

function safeErrorMessage(error: unknown, write: boolean): string {
  if (
    write &&
    (error instanceof IntervalsAbortError ||
      error instanceof IntervalsNetworkError ||
      error instanceof IntervalsResponseError)
  ) {
    return "Intervals write outcome is uncertain; the operation may have been applied. Check the resource before retrying.";
  }
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
