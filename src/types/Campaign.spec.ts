import { describe, it, expect } from "vitest";
import { SAFETY_PRESETS, DEFAULT_TIMING, DEFAULT_BATCH } from "./Campaign";
import type { SafetyLevel } from "./Campaign";

describe("SAFETY_PRESETS", () => {
  it("should have three levels", () => {
    const levels: SafetyLevel[] = ["safe", "moderate", "aggressive"];
    expect(Object.keys(SAFETY_PRESETS)).toEqual(levels);
  });

  it("safe should have slowest delays and lowest limit", () => {
    const { timing } = SAFETY_PRESETS.safe;
    expect(timing.minDelay).toBeGreaterThanOrEqual(30);
    expect(timing.maxDelay).toBeGreaterThanOrEqual(60);
    expect(timing.dailyLimit).toBeLessThanOrEqual(30);
  });

  it("aggressive should have fastest delays and highest limit", () => {
    const { timing } = SAFETY_PRESETS.aggressive;
    expect(timing.minDelay).toBeLessThan(SAFETY_PRESETS.safe.timing.minDelay);
    expect(timing.dailyLimit).toBeGreaterThan(SAFETY_PRESETS.safe.timing.dailyLimit);
  });

  it("moderate should be between safe and aggressive", () => {
    const safe = SAFETY_PRESETS.safe.timing;
    const moderate = SAFETY_PRESETS.moderate.timing;
    const aggressive = SAFETY_PRESETS.aggressive.timing;

    expect(moderate.minDelay).toBeLessThan(safe.minDelay);
    expect(moderate.minDelay).toBeGreaterThan(aggressive.minDelay);
    expect(moderate.dailyLimit).toBeGreaterThan(safe.dailyLimit);
    expect(moderate.dailyLimit).toBeLessThan(aggressive.dailyLimit);
  });

  it("all presets should have labels and descriptions", () => {
    for (const preset of Object.values(SAFETY_PRESETS)) {
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.description.length).toBeGreaterThan(10);
    }
  });
});

describe("DEFAULT_TIMING", () => {
  it("should use safe preset values", () => {
    const safe = SAFETY_PRESETS.safe.timing;
    expect(DEFAULT_TIMING.minDelay).toBe(safe.minDelay);
    expect(DEFAULT_TIMING.maxDelay).toBe(safe.maxDelay);
    expect(DEFAULT_TIMING.dailyLimit).toBe(safe.dailyLimit);
  });

  it("should default to random delay mode", () => {
    expect(DEFAULT_TIMING.delayMode).toBe("random");
  });

  it("should have schedule enabled with weekdays", () => {
    expect(DEFAULT_TIMING.schedule.enabled).toBe(true);
    expect(DEFAULT_TIMING.schedule.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("DEFAULT_BATCH", () => {
  it("should have reasonable batch size", () => {
    expect(DEFAULT_BATCH.batchSize).toBeGreaterThan(0);
    expect(DEFAULT_BATCH.batchSize).toBeLessThanOrEqual(50);
  });

  it("should pause between batches by default", () => {
    expect(DEFAULT_BATCH.pauseBetweenBatches).toBe(true);
  });
});
