import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TimingControls from "./TimingControls";
import { DEFAULT_TIMING, SAFETY_PRESETS } from "../../types/Campaign";
import type { TimingConfig } from "../../types/Campaign";

function makeConfig(overrides: Partial<TimingConfig> = {}): TimingConfig {
  return { ...DEFAULT_TIMING, ...overrides };
}

describe("TimingControls", () => {
  let onChange: ReturnType<typeof vi.fn>;

  const sut = (config: TimingConfig = makeConfig()) => {
    onChange = vi.fn();
    render(<TimingControls config={config} onChange={onChange} />);
    return { onChange };
  };

  beforeEach(() => {
    onChange = vi.fn();
  });

  describe("Safety Presets", () => {
    it("should render all three preset buttons", () => {
      sut();
      expect(screen.getByText("Seguro")).toBeInTheDocument();
      expect(screen.getByText("Moderado")).toBeInTheDocument();
      expect(screen.getByText("Agressivo")).toBeInTheDocument();
    });

    it("should apply safe preset values on click", async () => {
      sut(makeConfig(SAFETY_PRESETS.aggressive.timing));
      await userEvent.click(screen.getByText("Seguro"));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minDelay: SAFETY_PRESETS.safe.timing.minDelay,
          maxDelay: SAFETY_PRESETS.safe.timing.maxDelay,
          dailyLimit: SAFETY_PRESETS.safe.timing.dailyLimit,
        }),
      );
    });

    it("should apply moderate preset values on click", async () => {
      sut();
      await userEvent.click(screen.getByText("Moderado"));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minDelay: SAFETY_PRESETS.moderate.timing.minDelay,
          maxDelay: SAFETY_PRESETS.moderate.timing.maxDelay,
          dailyLimit: SAFETY_PRESETS.moderate.timing.dailyLimit,
        }),
      );
    });

    it("should show description for current preset", () => {
      sut(makeConfig(SAFETY_PRESETS.safe.timing));
      expect(screen.getByText(SAFETY_PRESETS.safe.description)).toBeInTheDocument();
    });

    it("should show 'Configuração personalizada' for non-preset values", () => {
      sut(makeConfig({ minDelay: 999, maxDelay: 9999, dailyLimit: 1 }));
      expect(screen.getByText("Configuração personalizada")).toBeInTheDocument();
    });
  });

  describe("Random delay forced", () => {
    it("should always set delayMode to random", async () => {
      sut();
      await userEvent.click(screen.getByText("Moderado"));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ delayMode: "random" }),
      );
    });
  });

  describe("Tooltips", () => {
    it("should show tooltip on click", async () => {
      sut();
      const tooltipButtons = screen.getAllByRole("button", { name: /info/i });
      expect(tooltipButtons.length).toBeGreaterThan(0);
      await userEvent.click(tooltipButtons[0]!);
      // Tooltip content should appear
      expect(screen.getByText(/WhatsApp detecta/i)).toBeInTheDocument();
    });
  });

  describe("Schedule", () => {
    it("should render day buttons when schedule enabled", () => {
      sut();
      expect(screen.getByText("Seg")).toBeInTheDocument();
      expect(screen.getByText("Dom")).toBeInTheDocument();
    });

    it("should toggle day on click", async () => {
      sut();
      await userEvent.click(screen.getByText("Dom"));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: expect.objectContaining({
            daysOfWeek: expect.arrayContaining([0]),
          }),
        }),
      );
    });
  });
});
