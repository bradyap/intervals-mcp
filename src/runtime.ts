import { IntervalsClient, type IntervalsAuth } from "@bradyap/intervals-client";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createIntervalsServer } from "./server.js";

export interface IntervalsEnvironment {
  readonly [name: string]: string | undefined;
  readonly INTERVALS_ACCESS_TOKEN?: string;
  readonly INTERVALS_API_KEY?: string;
}

export function resolveIntervalsAuth(
  environment: IntervalsEnvironment,
): IntervalsAuth {
  const accessToken = environment.INTERVALS_ACCESS_TOKEN;
  const apiKey = environment.INTERVALS_API_KEY;
  if (apiKey !== undefined && accessToken === undefined) {
    return { apiKey, kind: "apiKey" };
  }

  if (accessToken !== undefined && apiKey === undefined) {
    return { accessToken, kind: "bearer" };
  }

  throw new Error("Configure exactly one Intervals credential.");
}

export async function startIntervalsMcp(
  environment: IntervalsEnvironment = process.env,
): Promise<void> {
  const client = new IntervalsClient({
    auth: resolveIntervalsAuth(environment),
  });
  const server = createIntervalsServer(client);

  await server.connect(new StdioServerTransport());
}
