import { Component } from 'react'
import type { TimingConfig, SafetyLevel } from '../../types/Campaign'
import { SAFETY_PRESETS } from '../../types/Campaign'
import { ControlInput } from '../atoms/ControlFactory'
import { t } from '../../utils/i18n'

interface TimingControlsProps {
  config: TimingConfig
  onChange: (config: TimingConfig) => void
}

interface TimingControlsState {
  activeTooltip: string | null
}

function getDays() {
  return [
    { value: 0, label: t('day_sun') },
    { value: 1, label: t('day_mon') },
    { value: 2, label: t('day_tue') },
    { value: 3, label: t('day_wed') },
    { value: 4, label: t('day_thu') },
    { value: 5, label: t('day_fri') },
    { value: 6, label: t('day_sat') },
  ]
}

const LEVEL_STYLES: Record<
  SafetyLevel,
  { bg: string; border: string; icon: string; text: string }
> = {
  safe: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/40',
    icon: '\u{1F6E1}\u{FE0F}',
    text: 'text-green-400',
  },
  moderate: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/40',
    icon: '\u{26A0}\u{FE0F}',
    text: 'text-yellow-400',
  },
  aggressive: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    icon: '\u{1F525}',
    text: 'text-red-400',
  },
}

function detectSafetyLevel(config: TimingConfig): SafetyLevel | null {
  for (const [level, preset] of Object.entries(SAFETY_PRESETS)) {
    const tm = preset.timing
    if (
      config.minDelay === tm.minDelay &&
      config.maxDelay === tm.maxDelay &&
      config.dailyLimit === tm.dailyLimit
    ) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return level as SafetyLevel
    }
  }
  return null
}

export default class TimingControls extends Component<TimingControlsProps, TimingControlsState> {
  override state: TimingControlsState = { activeTooltip: null }

  private update(partial: Partial<TimingConfig>) {
    this.props.onChange({
      ...this.props.config,
      ...partial,
      delayMode: 'random',
    })
  }

  private applyPreset(level: SafetyLevel) {
    const preset = SAFETY_PRESETS[level]
    this.update({
      minDelay: preset.timing.minDelay,
      maxDelay: preset.timing.maxDelay,
      dailyLimit: preset.timing.dailyLimit,
    })
  }

  private toggleTooltip(id: string) {
    this.setState((prev) => ({
      activeTooltip: prev.activeTooltip === id ? null : id,
    }))
  }

  override render() {
    const { config } = this.props
    const { schedule } = config
    const { activeTooltip } = this.state
    const currentLevel = detectSafetyLevel(config)

    return (
      <div className="flex flex-col gap-3">
        {/* Safety Presets */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium">{t('safety_level')}</label>
            <Tooltip
              id="safety"
              active={activeTooltip === 'safety'}
              onToggle={() => {
                this.toggleTooltip('safety')
              }}
              text={t('safety_tooltip')}
            />
          </div>
          <div className="flex gap-1.5">
            {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
            {(Object.keys(SAFETY_PRESETS) as SafetyLevel[]).map((level) => {
              const preset = SAFETY_PRESETS[level]
              const style = LEVEL_STYLES[level]
              const isActive = currentLevel === level
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    this.applyPreset(level)
                  }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-xs transition-all ${
                    isActive
                      ? `${style.bg} ${style.border} ${style.text} border-2`
                      : 'bg-muted border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  <span className="text-base leading-none">{style.icon}</span>
                  <span className="font-medium">{preset.label}</span>
                </button>
              )
            })}
          </div>
          {currentLevel && (
            <p className={`text-[10px] ${LEVEL_STYLES[currentLevel].text} leading-tight`}>
              {SAFETY_PRESETS[currentLevel].description}
            </p>
          )}
          {!currentLevel && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              {t('custom_config')}
            </p>
          )}
        </div>

        {/* Random Delay (always random) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium">{t('random_interval')}</label>
            <Tooltip
              id="delay"
              active={activeTooltip === 'delay'}
              onToggle={() => {
                this.toggleTooltip('delay')
              }}
              text={t('random_delay_tooltip')}
            />
          </div>
          <div className="flex items-center gap-2">
            <ControlInput
              type="number"
              min="5"
              max="300"
              value={config.minDelay}
              onChange={(e) => {
                const val = Number(e.target.value)
                this.update({
                  minDelay: val,
                  maxDelay: Math.max(val + 5, config.maxDelay),
                })
              }}
              className="flex-1"
            />
            <span className="text-xs">—</span>
            <ControlInput
              type="number"
              min="10"
              max="600"
              value={config.maxDelay}
              onChange={(e) => {
                this.update({ maxDelay: Number(e.target.value) })
              }}
              className="flex-1"
            />
          </div>
        </div>

        {/* Daily Limit */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium">{t('daily_limit')}</label>
            <Tooltip
              id="limit"
              active={activeTooltip === 'limit'}
              onToggle={() => {
                this.toggleTooltip('limit')
              }}
              text={t('daily_limit_tooltip')}
            />
          </div>
          <div className="flex items-center gap-2">
            <ControlInput
              type="number"
              min="0"
              max="200"
              value={config.dailyLimit}
              onChange={(e) => {
                this.update({ dailyLimit: Number(e.target.value) })
              }}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">{t('no_limit')}</span>
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
                })
              }}
            />
            {t('business_hours_only')}
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
                    })
                  }}
                  className="w-14"
                />
                <span className="text-xs">{t('hour_until')}</span>
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
                    })
                  }}
                  className="w-14"
                />
                <span className="text-xs">{t('hour')}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {getDays().map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => {
                      const days = schedule.daysOfWeek.includes(d.value)
                        ? schedule.daysOfWeek.filter((x) => x !== d.value)
                        : [...schedule.daysOfWeek, d.value]
                      this.update({
                        schedule: { ...schedule, daysOfWeek: days },
                      })
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      schedule.daysOfWeek.includes(d.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
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
    )
  }
}

/* ---- Tooltip atom ---- */

function Tooltip({
  id,
  text,
  active,
  onToggle,
}: {
  id: string
  text: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Info sobre ${id}`}
        onClick={onToggle}
        className="w-4 h-4 rounded-full bg-muted border border-input text-[10px] leading-none text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors flex items-center justify-center"
      >
        ?
      </button>
      {active && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 rounded-lg bg-popover border border-input text-[10px] text-popover-foreground leading-snug shadow-lg">
          {text}
        </div>
      )}
    </span>
  )
}
