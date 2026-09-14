# Intervals MCP

Make chat your cycling coach (for better or for worse)

## Ubuntu / Docker Compose / ChatGPT web

The Compose service runs the existing stdio server under OpenAI's Secure MCP
Tunnel client. It publishes no ports and needs no reverse proxy, router changes,
or persistent volume. Docker supplies Node.js 24. The tunnel client is pinned to
`v0.0.14`; its official image supports Linux amd64 and arm64.

### 1. Create the OpenAI tunnel

Open [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels),
create a tunnel, and associate it with your ChatGPT workspace. Copy its tunnel ID.
Create a **runtime API key**, not an admin key, from
[Platform API keys](https://platform.openai.com/settings/organization/api-keys).
The runtime principal needs Tunnels Read + Use; creating the tunnel needs Read +
Manage. ChatGPT developer-mode access is separate. Confirm these account features
are available before deploying.

See the [official tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
for account setup and the current supported release. Review the Dockerfile pin
when upgrading the tunnel client.

### 2. Clone and configure on Ubuntu

These commands assume Docker, Docker Compose v2, and Git are already installed.
Run them in the directory where you keep your Compose projects:

```sh
git clone https://github.com/bradyap/intervals-mcp.git
cd intervals-mcp
cp .env.example .env
chmod 600 .env
nano .env
```

Fill in all three values: `CONTROL_PLANE_TUNNEL_ID`, `CONTROL_PLANE_API_KEY`
(OpenAI runtime key), and `INTERVALS_API_KEY` (your Intervals key). The Compose
deployment uses API-key authentication only. The standalone Node server also
supports a bearer token; set exactly one Intervals credential there.

Keep `.env` on the server. Git ignores it, and the Docker build context excludes
it. Credentials are injected at runtime, not baked into the image. Docker
administrators can inspect container environment variables. Avoid sharing
`docker inspect` output or expanded `docker compose config` output.

### 3. Build, check, and start

```sh
docker compose config --quiet
docker compose build
docker compose run --rm --no-deps --entrypoint node intervals scripts/stdio-smoke.mjs
docker compose up -d
docker compose ps
```

The smoke check uses a dummy credential and checks startup plus the five
read-only tools without calling Intervals. Wait for the running container to
become healthy. The health check checks tunnel readiness, not the validity of
your Intervals key. The server needs outbound HTTPS to OpenAI and Intervals. The
image build also needs access to Docker registries, npm, GitHub, and Debian
package mirrors. Public GitHub dependencies use HTTPS inside the build, so no
personal SSH key is needed.

If the container is unhealthy, run the tunnel's diagnostic locally on the server:

```sh
docker compose exec intervals tunnel-client doctor --explain
```

Keep diagnostic output private and leave raw HTTP logging disabled.

### 4. Connect ChatGPT

Enable Developer mode in ChatGPT's Settings → Security and login. In Plugins,
create a connection, choose **Tunnel**, and select the tunnel you created.
Confirm that exactly five tools appear. Try: "Use Intervals to summarize my last
seven days of cycling." This first real tool call checks your Intervals key.

See [ChatGPT connection instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt).
Keep the container running while using the connection. Access to this tunnel
grants access to this instance's configured Intervals account; use separate
instances and restricted tunnel associations for other people.

### Updates and shutdown

```sh
git pull --ff-only
docker compose up -d --build
```

After changing `.env`, run `docker compose up -d` to recreate the service with
the changed environment. Use `docker compose down` to stop and remove the
container; your `.env` stays on disk. `restart: unless-stopped` restarts the
service after a host reboot when Docker starts. Docker does not automatically
restart a container just because its health check fails.

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
