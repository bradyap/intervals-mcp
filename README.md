# Intervals MCP

Make chat your cycling coach (for better or for worse)

## Setup

```sh
npm ci
npm run build
npm start
```

Set either credential in your environment:

- `INTERVALS_API_KEY` for a personal API key
- `INTERVALS_ACCESS_TOKEN` for a bearer access token

## Tools

| Tool              | Inputs                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| `athlete_get`     | optional `athleteId`                                                                    |
| `activities_list` | required `oldest`, `newest`; optional `athleteId`                                       |
| `activity_get`    | required `activityId`; optional `intervals`                                             |
| `wellness_list`   | required `oldest`, `newest`; optional `athleteId`                                       |
| `events_list`     | required `oldest`, `newest`; optional `athleteId`, `calendar_id`, `category`, `resolve` |