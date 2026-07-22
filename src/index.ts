import { startIntervalsMcp } from "./runtime.js";

try {
  await startIntervalsMcp();
} catch {
  process.stderr.write("Intervals MCP server failed to start.\n");
  process.exitCode = 1;
}
