# Intervals MCP

Make chat your cycling coach (for better or for worse)

## Setup

Requires Docker Compose and ChatGPT developer-mode access. No public ports needed.

1. Create a [Secure MCP Tunnel](https://platform.openai.com/settings/organization/tunnels)
   associated with your ChatGPT workspace and a [runtime API key](https://platform.openai.com/settings/organization/api-keys)
   with Tunnels Read + Use access.
2. Clone and configure on your server:

   ```sh
   git clone https://github.com/bradyap/intervals-mcp.git
   cd intervals-mcp
   cp .env.example .env
   chmod 600 .env
   nano .env
   ```

   Fill in `CONTROL_PLANE_TUNNEL_ID`, `CONTROL_PLANE_API_KEY`, and
   `INTERVALS_API_KEY`. Keep `.env` private; it is ignored by Git.

3. Start the server:

   ```sh
   docker compose up -d --build
   docker compose ps
   ```

4. Enable Developer mode in ChatGPT, then add a connection in Plugins using
   **Tunnel** and select yours. Try: "Summarize my last seven days of cycling."

See the [tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
for account setup and troubleshooting.

## Update

```sh
git pull --ff-only
docker compose up -d --build
```

## Tools

All tools are read-only.

- `athlete_get` — athlete profile
- `activities_list` — activities between `oldest` and `newest`
- `activity_get` — one activity by `activityId`
- `wellness_list` — wellness between `oldest` and `newest`
- `events_list` — calendar events between `oldest` and `newest`

Dates use `YYYY-MM-DD`.
