import { Component } from "react";
import type { TimingConfig } from "../../types/Campaign";
import { ControlInput, ControlSelect } from "../atoms/ControlFactory";

interface TimingControlsProps {
  config: TimingConfig;
  onChange: (config: TimingConfig) => void;
}

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export default class TimingControls extends Component<TimingControlsProps> {
  private update(partial: Partial<TimingConfig>) {
    this.props.onChange({ ...this.props.config, ...partial });
  }

  override render() {
    const { config } = this.props;
    const { schedule } = config;

    return (
      <div className="flex flex-col gap-3">
        {/* Delay Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Delay</label>
          <ControlSelect
            value={config.delayMode}
            onChange={(e) => {
              this.update({
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                delayMode: e.target.value as "fixed" | "random",
              });
            }}
          >
            <option value="fixed">Fixo</option>
            <option value="random">Aleatório</option>
          </ControlSelect>
        </div>

        {config.delayMode === "fixed" ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs">Segundos</label>
            <div className="flex items-center gap-2">
              <ControlInput
                type="range"
                min="1"
                max="30"
                step="1"
                value={config.fixedDelay}
                onChange={(e) => {
                  this.update({ fixedDelay: Number(e.target.value) });
                }}
                className="flex-1"
              />
              <span className="text-xs font-mono w-6 text-right">
                {config.fixedDelay}s
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs">Min — Max (seg)</label>
            <div className="flex items-center gap-2">
              <ControlInput
                type="number"
                min="1"
                max="60"
                value={config.minDelay}
                onChange={(e) => {
                  this.update({ minDelay: Number(e.target.value) });
                }}
                className="flex-1"
              />
              <span className="text-xs">—</span>
              <ControlInput
                type="number"
                min="1"
                max="120"
                value={config.maxDelay}
                onChange={(e) => {
                  this.update({ maxDelay: Number(e.target.value) });
                }}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {/* Daily Limit */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Limite diário</label>
          <div className="flex items-center gap-2">
            <ControlInput
              type="number"
              min="0"
              max="500"
              value={config.dailyLimit}
              onChange={(e) => {
                this.update({ dailyLimit: Number(e.target.value) });
              }}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">
              0 = sem limite
            </span>
          </div>
        </div>

        {/* Schedule */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => {
                this.update({
                  schedule: { ...schedule, enabled: e.target.checked },
                });
              }}
            />
            Só horário comercial
          </label>

          {schedule.enabled && (
            <>
              <div className="flex items-center gap-2">
                <ControlInput
                  type="number"
                  min="0"
                  max="23"
                  value={schedule.startHour}
                  onChange={(e) => {
                    this.update({
                      schedule: {
                        ...schedule,
                        startHour: Number(e.target.value),
                      },
                    });
                  }}
                  className="w-14"
                />
                <span className="text-xs">h até</span>
                <ControlInput
                  type="number"
                  min="0"
                  max="23"
                  value={schedule.endHour}
                  onChange={(e) => {
                    this.update({
                      schedule: {
                        ...schedule,
                        endHour: Number(e.target.value),
                      },
                    });
                  }}
                  className="w-14"
                />
                <span className="text-xs">h</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => {
                      const days = schedule.daysOfWeek.includes(d.value)
                        ? schedule.daysOfWeek.filter((x) => x !== d.value)
                        : [...schedule.daysOfWeek, d.value];
                      this.update({
                        schedule: { ...schedule, daysOfWeek: days },
                      });
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      schedule.daysOfWeek.includes(d.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}
