# Intervals MCP

Private, read-only Model Context Protocol server for a focused Intervals.icu workflow. It requires Node.js 24 or newer, uses the stdio transport, and pins `@bradyap/intervals-client` to client candidate `07d0f9f0f92e95c5373105e2ccf73d9ecb9fe561`.

## Setup

```sh
npm ci
npm run build
npm start
```

Provide exactly one credential in the server process environment:

- `INTERVALS_API_KEY` for an Intervals personal API key
- `INTERVALS_ACCESS_TOKEN` for a bearer access token

Do not put credentials in arguments, tracked files, or tool inputs. Configure an MCP host to run `node` with the absolute path to `dist/index.js`; stdout is reserved for MCP messages.

## Tools

Every exposed tool is annotated read-only. No Intervals write methods are registered.

| Tool              | Inputs                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| `athlete_get`     | optional `athleteId`                                                                    |
| `activities_list` | required `oldest`, `newest`; optional `athleteId`                                       |
| `activity_get`    | required `activityId`; optional `intervals`                                             |
| `wellness_list`   | required `oldest`, `newest`; optional `athleteId`                                       |
| `events_list`     | required `oldest`, `newest`; optional `athleteId`, `calendar_id`, `category`, `resolve` |

Date ranges use `YYYY-MM-DD`. `category` is an array of strings and is forwarded as repeated query parameters by the client. Intervals request and response field casing is preserved exactly, including `calendar_id`; successful results are returned as compact JSON text without dropping unknown response fields.

Client failures become fixed, safe MCP tool errors. Error response bodies, causes, URLs, headers, credentials, and private diagnostics are not returned or logged.

## Development

```sh
npm run check
```

The check runs strict TypeScript, ESLint, Prettier, protocol-level tests, a production build, and a spawned stdio startup/tool-list smoke test.
