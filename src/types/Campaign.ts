import type { Attachment } from './Attachment'

export interface MessageVariant {
  id: string
  name: string
  /** @deprecated Use templates[] instead */
  template: string
  templates: string[]
  useAI: boolean
  aiPrompt?: string
  attachment?: Attachment
}

/** Normalize legacy variants that only have `template` to use `templates[]` */
export function normalizeVariant(v: MessageVariant): MessageVariant {
  if (v.templates.length === 0) {
    return { ...v, templates: v.template ? [v.template] : [''] }
  }
  return { ...v, template: v.templates[0] ?? '' }
}

export interface SendSchedule {
  enabled: boolean
  startHour: number
  endHour: number
  daysOfWeek: number[]
}

export interface TimingConfig {
  delayMode: 'fixed' | 'random'
  fixedDelay: number
  minDelay: number
  maxDelay: number
  dailyLimit: number
  schedule: SendSchedule
}

export interface BatchConfig {
  batchSize: number
  pauseBetweenBatches: boolean
}

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'preview'

export interface CampaignResult {
  leadId: string
  variantId: string
  contact: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  generatedMessage?: string
  sentAt?: string
  error?: string
}

export interface Campaign {
  id: string
  name: string
  leadIds: string[]
  variants: MessageVariant[]
  timing: TimingConfig
  batch: BatchConfig
  results: CampaignResult[]
  status: CampaignStatus
  pauseReason?: string
  dailySentCount: number
  dailyResetDate: string
  createdAt: string
}

export type SafetyLevel = 'safe' | 'moderate' | 'aggressive'

export interface SafetyPreset {
  level: SafetyLevel
  label: string
  description: string
  timing: Omit<TimingConfig, 'delayMode' | 'fixedDelay' | 'schedule'>
}

export const SAFETY_PRESETS: Record<SafetyLevel, SafetyPreset> = {
  safe: {
    level: 'safe',
    label: 'Seguro',
    description: 'Ideal para contas novas ou que já foram advertidas. Menor risco de banimento.',
    timing: { minDelay: 45, maxDelay: 120, dailyLimit: 20 },
  },
  moderate: {
    level: 'moderate',
    label: 'Moderado',
    description: 'Para contas com mais de 1 mês de uso ativo. Risco médio.',
    timing: { minDelay: 20, maxDelay: 60, dailyLimit: 40 },
  },
  aggressive: {
    level: 'aggressive',
    label: 'Agressivo',
    description: 'Para contas antigas (3+ meses). Maior volume, maior risco de banimento.',
    timing: { minDelay: 8, maxDelay: 30, dailyLimit: 80 },
  },
}

export const DEFAULT_TIMING: TimingConfig = {
  delayMode: 'random',
  fixedDelay: 5,
  minDelay: SAFETY_PRESETS.safe.timing.minDelay,
  maxDelay: SAFETY_PRESETS.safe.timing.maxDelay,
  dailyLimit: SAFETY_PRESETS.safe.timing.dailyLimit,
  schedule: {
    enabled: true,
    startHour: 8,
    endHour: 20,
    daysOfWeek: [1, 2, 3, 4, 5],
  },
}

export const DEFAULT_BATCH: BatchConfig = {
  batchSize: 10,
  pauseBetweenBatches: true,
}
