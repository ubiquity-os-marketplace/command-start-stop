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

export const startStopSchema = T.Object(
  {
    reviewDelayTolerance: T.String({ default: "1 Day" }),
    taskStaleTimeoutDuration: T.String({ default: "30 Days" }),
    maxConcurrentTasks: T.Number({ default: 3 }),
    startRequiresWallet: T.Boolean({ default: true }),
  },
  {
    default: {},
  }
);

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
export const startStopSettingsValidator = new StandardValidator(startStopSchema);
