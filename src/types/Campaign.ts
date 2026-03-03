import type { Attachment } from "./Attachment";

export interface MessageVariant {
  id: string;
  name: string;
  template: string;
  useAI: boolean;
  aiPrompt?: string;
  attachment?: Attachment;
}

export interface SendSchedule {
  enabled: boolean;
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
}

export interface TimingConfig {
  delayMode: "fixed" | "random";
  fixedDelay: number;
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
  schedule: SendSchedule;
}

export interface BatchConfig {
  batchSize: number;
  pauseBetweenBatches: boolean;
}

export type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "preview";

export interface CampaignResult {
  leadId: string;
  variantId: string;
  contact: string;
  status: "pending" | "sent" | "failed" | "skipped";
  generatedMessage?: string;
  sentAt?: string;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  leadIds: string[];
  variants: MessageVariant[];
  timing: TimingConfig;
  batch: BatchConfig;
  results: CampaignResult[];
  status: CampaignStatus;
  dailySentCount: number;
  dailyResetDate: string;
  createdAt: string;
}

export const DEFAULT_TIMING: TimingConfig = {
  delayMode: "random",
  fixedDelay: 5,
  minDelay: 3,
  maxDelay: 8,
  dailyLimit: 50,
  schedule: {
    enabled: true,
    startHour: 8,
    endHour: 18,
    daysOfWeek: [1, 2, 3, 4, 5],
  },
};

export const DEFAULT_BATCH: BatchConfig = {
  batchSize: 10,
  pauseBetweenBatches: true,
};
