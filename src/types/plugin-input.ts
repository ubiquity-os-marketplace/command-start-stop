import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: StartStopSettings;
  authToken: string;
  ref: string;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

export const startStopSchema = T.Object({
  timers: T.Object(
    {
      reviewDelayTolerance: T.Number(),
      taskStaleTimeoutDuration: T.Number(),
    },
    { default: { reviewDelayTolerance: ONE_DAY * 5, taskStaleTimeoutDuration: ONE_DAY * 30 } }
  ),
  miscellaneous: T.Object(
    {
      maxConcurrentTasks: T.Number(),
      startRequiresWallet: T.Boolean(),
    },
    { default: { maxConcurrentTasks: 3, startRequiresWallet: true } }
  ),
});

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
export const startStopSettingsValidator = new StandardValidator(startStopSchema);
