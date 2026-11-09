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

Calendar events are scheduled items; workout-library entries are reusable templates.
Creating a library workout does not schedule it.

- `athlete_get` — athlete profile
- `activities_list` — activities between `oldest` and `newest`
- `activity_get` — one activity by `activityId`
- `wellness_list` — wellness between `oldest` and `newest`
- `events_list` — calendar events between `oldest` and `newest`
- `event_get`, `event_create`, `event_update`, `event_delete` — individual calendar events
- `workouts_list`, `workout_get`, `workout_create`, `workout_update`, `workout_delete` — reusable workout-library entries
- `calendars_list`, `folders_list` — available calendars and workout-library folders
- `sport_settings_list`, `sport_settings_get` — API sport settings, including available thresholds and zones, returned unchanged

All athlete-scoped tools accept optional `athleteId`, defaulting to the client's
configured athlete (normally `0`, the authenticated athlete). Event, workout and
sport-settings IDs accept strings or numbers; activity IDs remain strings.

Writes take an `event` or `workout` object. Both expose `name`, `description` and
sport `type` (e.g. `Ride`). Events also expose `calendar_id`, `category` (e.g.
`WORKOUT`, `RACE`, `NOTE`), `start_date_local` and `end_date_local`; library workouts
expose `folder_id`. Local timestamps use `YYYY-MM-DDTHH:mm:ss` without a timezone
suffix or UTC conversion. Structured content uses native Intervals.icu
workout-builder text in `description`, as described in the
[official API guide](https://forum.intervals.icu/t/api-access-to-intervals-icu/609).
`workout_doc`, file uploads, identity fields and `upsertOnUid` are not exposed.

Payload fields are optional and support explicit `null`; only supplied fields
are forwarded. Omitted-field behavior depends on the API operation; inspect
results rather than assuming every update is a patch. Creates are not idempotent.
Event deletion returns `{ "deleted": true, "eventId": <requested ID> }`; workout
deletion preserves the client's deleted-ID array. Other results are JSON in text.

Writes can overwrite or delete data. Network, cancellation and response-parsing
failures may occur after a write was applied: inspect the resource before retrying.
Cancellation is forwarded to the client and does not imply rollback; a cancelled
MCP request may never receive the final tool result. No automatic retries occur.

## Local verification

Run `npm run check` for typechecking, lint, formatting, mocked in-memory MCP tests,
build and a discovery-only stdio smoke test using a dummy credential. No test
requires credentials or modifies live Intervals data.
