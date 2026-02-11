import { describe, expect, it } from "@jest/globals";
import { calculateDurations } from "../src/utils/shared";

function createLabels(...names: string[]) {
  return names.map((name) => ({ name })) as Parameters<typeof calculateDurations>[0];
}

describe("calculateDurations", () => {
  it("parses legacy labels with angle brackets", () => {
    const durations = calculateDurations(createLabels("Time: <1 Hour"));
    expect(durations).toEqual([3600]);
  });

  it("parses plain text duration labels", () => {
    const durations = calculateDurations(createLabels("Time: 1 Day"));
    expect(durations).toEqual([86400]);
  });

  it("parses compact unit labels", () => {
    const durations = calculateDurations(createLabels("Time: 1h"));
    expect(durations).toEqual([3600]);
  });

  it("sorts multiple durations from shortest to longest", () => {
    const durations = calculateDurations(createLabels("Time: 2 Days", "Time: 1h", "Time: <30 Minutes"));
    expect(durations).toEqual([1800, 3600, 172800]);
  });

  it("ignores non-time and malformed labels", () => {
    const durations = calculateDurations(createLabels("Priority: 1 (Normal)", "Price: 300 USD", "Time: sometime soon", "Time: "));
    expect(durations).toEqual([]);
  });
});
