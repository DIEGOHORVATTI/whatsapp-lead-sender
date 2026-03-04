import type { Campaign, CampaignResult, MessageVariant } from 'types/Campaign'
import { DEFAULT_TIMING, normalizeVariant } from 'types/Campaign'
import type { Lead } from 'types/Lead'
import type { AIConfig } from 'types/AIConfig'
import { ChromeMessageTypes } from 'types/ChromeMessageTypes'

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// ── Types ────────────────────────────────────────────────────────────────────

interface CampaignRunState {
  campaign: Campaign
  leads: Lead[]
  aiConfig?: AIConfig
  aborted: boolean
  paused: boolean
}

type BgMessageType =
  | { type: 'BG_START_CAMPAIGN'; campaign: Campaign; leads: Lead[]; aiConfig?: AIConfig }
  | { type: 'BG_PAUSE_CAMPAIGN' }
  | { type: 'BG_RESUME_CAMPAIGN' }
  | { type: 'BG_STOP_CAMPAIGN' }
  | { type: 'BG_GET_STATUS' }

// ── IndexedDB helpers (service worker has access) ────────────────────────────

const DB_NAME = 'WTFCampaignDB'
const DB_VERSION = 2
const CAMPAIGNS_STORE = 'campaigns'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CAMPAIGNS_STORE)) {
        db.createObjectStore(CAMPAIGNS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('leads')) {
        db.createObjectStore('leads', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('leadMeta')) {
        db.createObjectStore('leadMeta', { keyPath: 'leadId' })
      }
    }
  })
}

async function saveCampaignToDB(campaign: Campaign): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS_STORE, 'readwrite')
    const req = tx.objectStore(CAMPAIGNS_STORE).put(campaign)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function listCampaignsFromDB(): Promise<Campaign[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS_STORE, 'readonly')
    const req = tx.objectStore(CAMPAIGNS_STORE).getAll()
    req.onsuccess = () => resolve(req.result as Campaign[])
    req.onerror = () => reject(req.error)
  })
}

// ── Send message to WhatsApp via content script ──────────────────────────────

async function sendWhatsAppMessage(contact: string, message: string): Promise<boolean> {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
  const tab = tabs[0]
  if (!tab?.id) return false

  return new Promise((resolve) => {
    const responseType = `${ChromeMessageTypes.SEND_MESSAGE}_RESPONSE`
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener)
      resolve(false)
    }, 60_000)

    const listener = (msg: { source?: string; type?: string; payload?: boolean }) => {
      if (msg.source === 'WTF' && msg.type === responseType) {
        chrome.runtime.onMessage.removeListener(listener)
        clearTimeout(timeout)
        resolve(msg.payload ?? false)
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    void chrome.tabs.sendMessage(tab.id!, {
      source: 'WTF',
      type: ChromeMessageTypes.SEND_MESSAGE,
      payload: { contact, message, buttons: [] },
    })
  })
}

// ── Template engine (minimal version for background) ─────────────────────────

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

const TITLE_CASE_FIELDS = new Set([
  'nome_fantasia', 'decisor', 'cargo', 'segmento',
  'razao_social', 'cidade', 'bairro', 'endereco',
])

const MODIFIERS: Record<string, (v: string) => string> = {
  first: (v) => v.trim().split(/\s+/)[0] ?? '',
  upper: (v) => v.toUpperCase(),
  lower: (v) => v.toLowerCase(),
}

function replaceVariables(template: string, lead: Lead): string {
  const result = template.replace(/\{(\w+)(?:\|(\w+))?\}/g, (_m, key: string, mod?: string) => {
    const raw = lead[key]
    if (raw === undefined || raw === '') return ''
    let value = String(raw)
    if (TITLE_CASE_FIELDS.has(key)) value = toTitleCase(value)
    if (mod) {
      const fn = MODIFIERS[mod]
      if (fn) value = fn(value)
    }
    return value
  })
  return result.replace(/ {2,}/g, ' ').trim()
}

function formatPhone(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith(countryCode) ? digits : countryCode + digits
}

// ── Campaign execution engine ────────────────────────────────────────────────

let runState: CampaignRunState | null = null

function broadcastStatus(campaign: Campaign) {
  void chrome.runtime.sendMessage({
    source: 'WTF',
    type: 'BG_CAMPAIGN_STATUS',
    campaign: { ...campaign },
  }).catch(() => { /* sidepanel may be closed */ })
}

function broadcastDelay(info: { totalMs: number; startedAt: number } | null) {
  void chrome.runtime.sendMessage({
    source: 'WTF',
    type: 'BG_CAMPAIGN_DELAY',
    delayInfo: info,
  }).catch(() => { /* sidepanel may be closed */ })
}

function addLog(level: number, message: string, contact = '') {
  chrome.storage.local.get(
    (data: { logs?: { level: number; message: string; contact: string; attachment: boolean; date: string }[] }) => {
      const logs = data.logs ?? []
      logs.push({ level, message, contact, attachment: false, date: new Date().toLocaleString() })
      void chrome.storage.local.set({ logs })
    }
  )
}

function assignVariant(variants: MessageVariant[]): MessageVariant {
  if (variants.length === 0) {
    return { id: 'default', name: 'Default', template: '', templates: [''], useAI: false }
  }
  return variants[Math.floor(Math.random() * variants.length)]!
}

function generateMessages(lead: Lead, variant: MessageVariant): string[] {
  const v = normalizeVariant(variant)
  const templates = v.templates.length > 0 ? v.templates : [v.template]
  const msgs: string[] = []
  for (const tpl of templates) {
    if (!tpl.trim()) continue
    // AI generation not supported in background (runs without API key context)
    // Falls back to template replacement
    msgs.push(replaceVariables(tpl, lead))
  }
  return msgs.length > 0 ? msgs : [replaceVariables(v.template, lead)]
}

function calculateDelay(campaign: Campaign): number {
  const cfg = campaign.timing ?? DEFAULT_TIMING
  if (cfg.delayMode === 'random') {
    return (cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay)) * 1000
  }
  return cfg.fixedDelay * 1000
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function runCampaign(): Promise<void> {
  if (!runState) return
  const { campaign, leads } = runState

  campaign.status = 'running'
  campaign.pauseReason = undefined
  broadcastStatus(campaign)
  addLog(2, `Campanha "${campaign.name}" iniciada — ${leads.length} leads`)

  const batchSize = campaign.batch?.batchSize || leads.length

  // Skip already processed leads
  const done = new Set(
    campaign.results
      .filter((r) => r.status === 'sent' || r.status === 'skipped' || r.status === 'failed')
      .map((r) => r.leadId)
  )
  const pending = leads.filter((l) => !done.has(l.id))

  if (pending.length === 0) {
    campaign.status = 'completed'
    addLog(2, `Campanha "${campaign.name}" — nenhum lead pendente`)
    broadcastStatus(campaign)
    await saveCampaignToDB(campaign)
    runState = null
    return
  }

  let batchStart = 0
  let pausedBySchedule = false
  let pausedByLimit = false

  while (batchStart < pending.length && runState && !runState.aborted) {
    const batch = pending.slice(batchStart, batchStart + batchSize)

    for (const lead of batch) {
      if (!runState || runState.aborted) break

      // Pause check
      if (runState.paused) {
        campaign.status = 'paused'
        broadcastStatus(campaign)
        // Wait until resumed or aborted
        while (runState && runState.paused && !runState.aborted) {
          await sleep(500)
        }
        if (!runState || runState.aborted) break
        campaign.status = 'running'
        broadcastStatus(campaign)
      }

      // Daily limit (global)
      const today = new Date().toISOString().slice(0, 10)
      if (campaign.dailyResetDate !== today) {
        campaign.dailySentCount = 0
        campaign.dailyResetDate = today
      }
      const dailyLimit = campaign.timing?.dailyLimit ?? 0
      if (dailyLimit > 0) {
        const allCampaigns = await listCampaignsFromDB()
        const globalSent = allCampaigns.reduce((sum, c) => {
          return c.dailyResetDate === today ? sum + c.dailySentCount : sum
        }, 0)
        if (globalSent >= dailyLimit) {
          pausedByLimit = true
          campaign.status = 'paused'
          campaign.pauseReason = `Limite diário atingido (${globalSent}/${dailyLimit} msgs).`
          addLog(2, `Limite diário atingido (${globalSent}/${dailyLimit}).`)
          broadcastStatus(campaign)
          break
        }
      }

      // Schedule check
      const schedule = campaign.timing?.schedule
      if (schedule?.enabled) {
        const now = new Date()
        const hour = now.getHours()
        const day = now.getDay()
        if (!schedule.daysOfWeek.includes(day) || hour < schedule.startHour || hour >= schedule.endHour) {
          pausedBySchedule = true
          campaign.status = 'paused'
          campaign.pauseReason = `Fora do horário permitido (${schedule.startHour}h às ${schedule.endHour}h).`
          addLog(2, `Fora do horário permitido. Campanha pausada.`)
          broadcastStatus(campaign)
          break
        }
      }

      // Process lead
      const isLast = lead === pending[pending.length - 1]
      await processLead(campaign, lead, isLast)
    }

    if (pausedBySchedule || pausedByLimit || !runState || runState.aborted) break

    batchStart += batchSize

    // Pause between batches
    if (
      campaign.batch?.pauseBetweenBatches &&
      batchStart < pending.length &&
      runState && !runState.aborted
    ) {
      if (runState) runState.paused = true
      campaign.status = 'paused'
      broadcastStatus(campaign)
      while (runState && runState.paused && !runState.aborted) {
        await sleep(500)
      }
      if (runState && !runState.aborted) {
        campaign.status = 'running'
      }
    }
  }

  // Final status
  if (runState && !runState.aborted && !pausedBySchedule && !pausedByLimit) {
    campaign.status = 'completed'
    const sent = campaign.results.filter((r) => r.status === 'sent').length
    const failed = campaign.results.filter((r) => r.status === 'failed').length
    addLog(3, `Campanha concluída — ${sent} enviadas, ${failed} falhas`)
  }

  broadcastStatus(campaign)
  await saveCampaignToDB(campaign)

  if (runState && !runState.paused) {
    runState = null
  }
}

async function processLead(campaign: Campaign, lead: Lead, isLast: boolean): Promise<void> {
  const variant = normalizeVariant(assignVariant(campaign.variants))
  const result: CampaignResult = {
    leadId: lead.id,
    variantId: variant.id,
    contact: formatPhone(lead.telefone),
    status: 'pending',
  }

  try {
    const messages = generateMessages(lead, variant)
    result.generatedMessage = messages.join('\n---\n')

    let contact = result.contact
    let sent = await sendWhatsAppMessage(contact, messages[0] ?? '')

    // Fallback to telefone_2
    if (!sent && lead.telefone_2) {
      const alt = formatPhone(lead.telefone_2)
      if (alt && alt !== contact) {
        contact = alt
        result.contact = alt
        sent = await sendWhatsAppMessage(alt, messages[0] ?? '')
      }
    }

    // Send remaining messages
    if (sent && messages.length > 1) {
      for (let i = 1; i < messages.length; i++) {
        await sleep(2000 + Math.random() * 2000)
        const msg = messages[i]
        if (msg) await sendWhatsAppMessage(contact, msg)
      }
    }

    if (sent) {
      result.status = 'sent'
      result.sentAt = new Date().toISOString()
      campaign.dailySentCount++
      addLog(3, `${messages.length} msg enviada(s)`, result.contact)
    } else {
      result.status = 'failed'
      result.error = 'Contact not found on WhatsApp'
      addLog(1, 'Contato não encontrado', result.contact)
    }
  } catch (err) {
    result.status = 'failed'
    result.error = err instanceof Error ? err.message : String(err)
    addLog(1, `Falha: ${result.error}`, result.contact)
  }

  campaign.results.push(result)
  await saveCampaignToDB(campaign)
  broadcastStatus(campaign)

  // Delay before next
  if (!isLast) {
    const delay = calculateDelay(campaign)
    if (delay > 0) {
      broadcastDelay({ totalMs: delay, startedAt: Date.now() })
      await sleep(delay)
      broadcastDelay(null)
    }
  }
}

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: BgMessageType & { source?: string; type?: string }, _sender, sendResponse) => {
    // Forward WTF messages between content script and sidepanel (existing behavior)
    // Only handle BG_* messages here

    if (msg.type === 'BG_START_CAMPAIGN') {
      if (runState && !runState.aborted) {
        // Stop current campaign first
        runState.aborted = true
      }
      const { campaign, leads, aiConfig } = msg
      runState = { campaign, leads, aiConfig, aborted: false, paused: false }
      void runCampaign()
      sendResponse(true)
      return
    }

    if (msg.type === 'BG_PAUSE_CAMPAIGN') {
      if (runState) runState.paused = true
      sendResponse(true)
      return
    }

    if (msg.type === 'BG_RESUME_CAMPAIGN') {
      if (runState) {
        runState.paused = false
      } else {
        // No active run — need to restart from storage (handled by sidepanel)
        sendResponse(false)
        return
      }
      sendResponse(true)
      return
    }

    if (msg.type === 'BG_STOP_CAMPAIGN') {
      if (runState) {
        runState.aborted = true
        if (runState.campaign) runState.campaign.status = 'paused'
        runState.paused = false // unblock if paused
      }
      sendResponse(true)
      return
    }

    if (msg.type === 'BG_GET_STATUS') {
      sendResponse({
        running: !!runState && !runState.aborted,
        paused: runState?.paused ?? false,
        campaign: runState?.campaign ?? null,
      })
      return
    }
  }
)
