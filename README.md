# Intervals MCP

Make chat your cycling coach (for better or for worse)

## Setup

Requires Docker Compose and chat developer mode access.

1. Create a [secure MCP tunnel](https://platform.openai.com/settings/organization/tunnels)
   associated with your chat workspace and a [runtime API key](https://platform.openai.com/settings/organization/api-keys)
   with tunnels read + use access.

2. Clone this repo and configure `CONTROL_PLANE_TUNNEL_ID`, `CONTROL_PLANE_API_KEY`, and `INTERVALS_API_KEY` in your .env.

3. Start the server:

   ```sh
   docker compose up -d --build
   docker compose ps
   ```

4. Enable Developer mode in chat, then add a connection in plugins using
   tunnel and select yours. More info in the [tunnel guide.](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

## Tools

All tools are read-only for now. Write access is the future goal so that chat can create workouts for you.

- `athlete_get` — athlete profile
- `activities_list` — activities between `oldest` and `newest`
- `activity_get` — one activity by `activityId`
- `wellness_list` — wellness between `oldest` and `newest`
- `events_list` — calendar events between `oldest` and `newest`