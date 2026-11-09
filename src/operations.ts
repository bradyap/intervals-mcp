import type {
  ActivitiesResource,
  AthleteResource,
  EventsResource,
  WellnessResource,
  WorkoutsResource,
  CalendarsResource,
  FoldersResource,
  SportSettingsResource,
} from "@bradyap/intervals-client";
export interface IntervalsOperations {
  readonly activities: Pick<ActivitiesResource, "get" | "list">;
  readonly athlete: Pick<AthleteResource, "get">;
  readonly events: Pick<
    EventsResource,
    "list" | "get" | "create" | "update" | "delete"
  >;
  readonly wellness: Pick<WellnessResource, "list">;
  readonly workouts: Pick<
    WorkoutsResource,
    "list" | "get" | "create" | "update" | "delete"
  >;
  readonly calendars: Pick<CalendarsResource, "list">;
  readonly folders: Pick<FoldersResource, "list">;
  readonly sportSettings: Pick<SportSettingsResource, "list" | "get">;
}
