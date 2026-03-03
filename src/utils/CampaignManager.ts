import type { AIConfig } from "../types/AIConfig";
import type {
  Campaign,
  CampaignResult,
  MessageVariant,
} from "../types/Campaign";
import { DEFAULT_BATCH, DEFAULT_TIMING } from "../types/Campaign";
import type { Lead } from "../types/Lead";
import campaignStorage from "./CampaignStorage";
import { generateMessage } from "./aiService";
import { downloadCSV, exportCampaignResults } from "./csvExporter";
import { formatPhone, replaceVariables } from "./templateEngine";

function addLog(level: number, message: string, contact = "", attachment = false) {
  chrome.storage.local.get(
    (data: { logs?: Array<{ level: number; message: string; contact: string; attachment: boolean; date: string }> }) => {
      const logs = data.logs ?? [];
      logs.push({ level, message, contact, attachment, date: new Date().toLocaleString() });
      void chrome.storage.local.set({ logs });
    },
  );
}

type StatusCallback = (campaign: Campaign) => void;

class CampaignManager {
  private currentCampaign?: Campaign;
  private leads: Lead[] = [];
  private aiConfig?: AIConfig;
  private statusCallback?: StatusCallback;
  private sendFn?: (contact: string, message: string) => Promise<boolean>;
  private aborted = false;
  private paused = false;
  private pauseResolve?: () => void;

  onStatusChange(cb: StatusCallback) {
    this.statusCallback = cb;
  }

  setSendFunction(fn: (contact: string, message: string) => Promise<boolean>) {
    this.sendFn = fn;
  }

  setAIConfig(config: AIConfig) {
    this.aiConfig = config;
  }

  createCampaign(
    name: string,
    leads: Lead[],
    variants: MessageVariant[],
  ): Campaign {
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name,
      leadIds: leads.map((l) => l.id),
      variants,
      timing: { ...DEFAULT_TIMING },
      batch: { ...DEFAULT_BATCH },
      results: [],
      status: "draft",
      dailySentCount: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    this.currentCampaign = campaign;
    this.leads = leads;
    return campaign;
  }

  async preview(campaign: Campaign, leads: Lead[]): Promise<CampaignResult[]> {
    this.currentCampaign = campaign;
    this.leads = leads;
    const results: CampaignResult[] = [];

    for (const lead of leads.slice(0, 5)) {
      const variant = this.assignVariant(campaign.variants);
      const message = await this.generateForLead(lead, variant);
      results.push({
        leadId: lead.id,
        variantId: variant.id,
        contact: formatPhone(lead.telefone),
        status: "pending",
        generatedMessage: message,
      });
    }
    return results;
  }

  async start(campaign: Campaign, leads: Lead[]): Promise<void> {
    this.currentCampaign = campaign;
    this.leads = leads;
    this.aborted = false;
    this.paused = false;
    campaign.status = "running";
    await this.emitStatus();
    addLog(2, `Campanha "${campaign.name}" iniciada — ${leads.length} leads`);

    console.log(
      "[WTF Campaign] Start:",
      campaign.name,
      "| leads:",
      leads.length,
      "| sendFn:",
      !!this.sendFn,
    );

    const batchSize = campaign.batch.batchSize || leads.length;
    let batchStart = 0;

    // Resume from where we left off
    const alreadySent = new Set(
      campaign.results
        .filter((r) => r.status === "sent" || r.status === "skipped")
        .map((r) => r.leadId),
    );
    const pendingLeads = leads.filter((l) => !alreadySent.has(l.id));
    console.log(
      "[WTF Campaign] Pending:",
      pendingLeads.length,
      "| already done:",
      alreadySent.size,
    );

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
    while (batchStart < pendingLeads.length && !this.aborted) {
      const batch = pendingLeads.slice(batchStart, batchStart + batchSize);

      for (const lead of batch) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
        if (this.aborted) break;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
        if (this.paused) {
          campaign.status = "paused";
          await this.emitStatus();
          await new Promise<void>((resolve) => {
            this.pauseResolve = resolve;
          });
          campaign.status = "running";
          await this.emitStatus();
        }

        // Daily limit
        const today = new Date().toISOString().slice(0, 10);
        if (campaign.dailyResetDate !== today) {
          campaign.dailySentCount = 0;
          campaign.dailyResetDate = today;
        }
        if (
          campaign.timing.dailyLimit > 0 &&
          campaign.dailySentCount >= campaign.timing.dailyLimit
        ) {
          campaign.status = "paused";
          await this.emitStatus();
          break;
        }

        // Schedule check
        if (campaign.timing.schedule.enabled) {
          const now = new Date();
          const hour = now.getHours();
          const day = now.getDay();
          if (
            !campaign.timing.schedule.daysOfWeek.includes(day) ||
            hour < campaign.timing.schedule.startHour ||
            hour >= campaign.timing.schedule.endHour
          ) {
            campaign.status = "paused";
            await this.emitStatus();
            break;
          }
        }

        await this.processLead(campaign, lead);
      }

      batchStart += batchSize;

      // Pause between batches
      if (
        campaign.batch.pauseBetweenBatches &&
        batchStart < pendingLeads.length &&
        !this.aborted // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
      ) {
        campaign.status = "paused";
        await this.emitStatus();
        await new Promise<void>((resolve) => {
          this.pauseResolve = resolve;
        });
        campaign.status = "running";
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated asynchronously
    if (!this.aborted) {
      campaign.status = "completed";
      const sent = campaign.results.filter((r) => r.status === "sent").length;
      const failed = campaign.results.filter((r) => r.status === "failed").length;
      addLog(3, `Campanha concluída — ${String(sent)} enviadas, ${String(failed)} falhas`);
    }
    await this.emitStatus();
  }

  private async processLead(campaign: Campaign, lead: Lead): Promise<void> {
    const variant = this.assignVariant(campaign.variants);
    const result: CampaignResult = {
      leadId: lead.id,
      variantId: variant.id,
      contact: formatPhone(lead.telefone),
      status: "pending",
    };

    try {
      const message = await this.generateForLead(lead, variant);
      result.generatedMessage = message;
      console.log(
        "[WTF Campaign] Processing lead:",
        result.contact,
        "| variant:",
        variant.name,
      );

      if (!this.sendFn) throw new Error("Send function not configured");

      // Try primary phone
      console.log("[WTF Campaign] Calling sendFn for:", result.contact);
      let sent = await this.sendFn(result.contact, message);
      console.log("[WTF Campaign] sendFn returned:", sent);

      // Fallback to telefone_2
      if (!sent && lead.telefone_2) {
        const alt = formatPhone(lead.telefone_2);
        if (alt && alt !== result.contact) {
          result.contact = alt;
          sent = await this.sendFn(alt, message);
        }
      }

      if (sent) {
        result.status = "sent";
        result.sentAt = new Date().toISOString();
        campaign.dailySentCount++;
        addLog(3, "Mensagem enviada", result.contact);
      } else {
        result.status = "failed";
        result.error = "Contact not found on WhatsApp";
        addLog(1, "Contato não encontrado no WhatsApp", result.contact);
      }
    } catch (err) {
      result.status = "failed";
      result.error = err instanceof Error ? err.message : String(err);
      addLog(1, `Falha: ${result.error}`, result.contact);
    }

    campaign.results.push(result);
    await campaignStorage.saveCampaign(campaign);
    await this.emitStatus();

    // Delay
    const delay = this.calculateDelay(campaign);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private assignVariant(variants: MessageVariant[]): MessageVariant {
    if (variants.length === 0) {
      return {
        id: "default",
        name: "Default",
        template: "",
        useAI: false,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return variants[Math.floor(Math.random() * variants.length)]!;
  }

  private async generateForLead(
    lead: Lead,
    variant: MessageVariant,
  ): Promise<string> {
    if (variant.useAI && this.aiConfig && this.aiConfig.provider !== "none") {
      const resp = await generateMessage(this.aiConfig, lead, variant.template);
      if (resp.text) return resp.text;
      // Fallback to template if AI fails
    }
    return replaceVariables(variant.template, lead);
  }

  private calculateDelay(campaign: Campaign): number {
    const cfg = campaign.timing;
    if (cfg.delayMode === "random") {
      return (
        (cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay)) * 1000
      );
    }
    return cfg.fixedDelay * 1000;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = undefined;
    }
  }

  stop() {
    this.aborted = true;
    if (this.currentCampaign) {
      this.currentCampaign.status = "paused";
    }
    this.resume(); // Unblock if paused
  }

  exportResults() {
    if (!this.currentCampaign) return;
    const csv = exportCampaignResults(this.currentCampaign, this.leads);
    const name = `campanha_${this.currentCampaign.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(csv, name);
  }

  getCampaign(): Campaign | undefined {
    return this.currentCampaign;
  }

  getStats(): {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byVariant: Record<string, { sent: number; failed: number }>;
  } {
    const c = this.currentCampaign;
    if (!c) return { total: 0, sent: 0, failed: 0, pending: 0, byVariant: {} };

    const sent = c.results.filter((r) => r.status === "sent").length;
    const failed = c.results.filter((r) => r.status === "failed").length;
    const byVariant: Record<string, { sent: number; failed: number }> = {};

    for (const v of c.variants) {
      const vResults = c.results.filter((r) => r.variantId === v.id);
      byVariant[v.name] = {
        sent: vResults.filter((r) => r.status === "sent").length,
        failed: vResults.filter((r) => r.status === "failed").length,
      };
    }

    return {
      total: c.leadIds.length,
      sent,
      failed,
      pending: c.leadIds.length - sent - failed,
      byVariant,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async emitStatus() {
    if (this.statusCallback && this.currentCampaign) {
      this.statusCallback({ ...this.currentCampaign });
    }
  }
}

const campaignManager = new CampaignManager();
export default campaignManager;
