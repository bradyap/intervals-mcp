import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedToolNames = [
  "athlete_get",
  "activities_list",
  "activity_get",
  "wellness_list",
  "events_list",
];

const transport = new StdioClientTransport({
  args: ["dist/index.js"],
  command: process.execPath,
  env: { INTERVALS_API_KEY: "stdio-smoke-sentinel" },
  stderr: "pipe",
});
const client = new Client({
  name: "intervals-mcp-stdio-smoke",
  version: "0.0.0",
});
let wroteToStderr = false;

transport.stderr?.on("data", () => {
  wroteToStderr = true;
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools(undefined, {
    signal: AbortSignal.timeout(5_000),
  });

  assert.deepEqual(
    tools.map(({ name }) => name),
    expectedToolNames,
  );
  assert.equal(
    tools.every(({ annotations }) => annotations?.readOnlyHint === true),
    true,
  );
  assert.equal(wroteToStderr, false);

  await client.close();
  process.stdout.write("Stdio startup and tool-list smoke passed.\n");
} catch {
  await client.close().catch(() => undefined);
  process.stderr.write("Stdio startup and tool-list smoke failed.\n");
  process.exitCode = 1;
}
