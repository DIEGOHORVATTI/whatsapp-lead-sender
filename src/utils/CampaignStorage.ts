import type { Campaign, CampaignResult } from '../types/Campaign'
import type { Lead, LeadMeta } from '../types/Lead'
import { normalizePhone } from '../types/Lead'

const DB_NAME = 'WTFCampaignDB'
const DB_VERSION = 2
const CAMPAIGNS_STORE = 'campaigns'
const LEADS_STORE = 'leads'
const LEAD_META_STORE = 'leadMeta'

class CampaignStorage {
  private db?: IDBDatabase

  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
      req.onsuccess = () => {
        this.db = req.result
        resolve(this.db)
      }
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(CAMPAIGNS_STORE)) {
          db.createObjectStore(CAMPAIGNS_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(LEADS_STORE)) {
          db.createObjectStore(LEADS_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(LEAD_META_STORE)) {
          db.createObjectStore(LEAD_META_STORE, { keyPath: 'leadId' })
        }
      }
    })
  }

  private async tx(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open()
    return db.transaction(store, mode).objectStore(store)
  }

  // Campaigns
  async saveCampaign(campaign: Campaign): Promise<void> {
    const store = await this.tx(CAMPAIGNS_STORE, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.put(campaign)
      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const store = await this.tx(CAMPAIGNS_STORE, 'readonly')
    return new Promise((resolve, reject) => {
      const req = store.get(id)
      req.onsuccess = () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(req.result as Campaign | undefined)
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async listCampaigns(): Promise<Campaign[]> {
    const store = await this.tx(CAMPAIGNS_STORE, 'readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(req.result as Campaign[])
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async deleteCampaign(id: string): Promise<void> {
    const store = await this.tx(CAMPAIGNS_STORE, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async updateResult(campaignId: string, result: CampaignResult): Promise<void> {
    const campaign = await this.getCampaign(campaignId)
    if (!campaign) return
    const idx = campaign.results.findIndex((r) => r.leadId === result.leadId)
    if (idx >= 0) {
      campaign.results[idx] = result
    } else {
      campaign.results.push(result)
    }
    await this.saveCampaign(campaign)
  }

  // Leads (bulk storage for large CSV imports)
  async saveLeads(leads: Lead[]): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(LEADS_STORE, 'readwrite')
    const store = tx.objectStore(LEADS_STORE)
    for (const lead of leads) {
      store.put(lead)
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        resolve()
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('IDB transaction failed'))
      }
    })
  }

  async saveLeadsDedup(leads: Lead[]): Promise<Lead[]> {
    const existing = await this.getAllLeads()
    const phoneMap = new Map<string, Lead>()
    for (const lead of existing) {
      const phone = normalizePhone(lead.telefone)
      if (phone) phoneMap.set(phone, lead)
    }

    const toSave: Lead[] = []
    for (const lead of leads) {
      const phone = normalizePhone(lead.telefone)
      if (!phone) continue
      const existingLead = phoneMap.get(phone)
      if (existingLead) {
        // Update existing lead with new data (keep existing id)
        const updated = { ...existingLead }
        const keys = Object.keys(lead)
        for (const k of keys) {
          if (k !== 'id' && lead[k]) {
            updated[k] = lead[k]
          }
        }
        toSave.push(updated)
        phoneMap.set(phone, updated)
      } else {
        toSave.push(lead)
        phoneMap.set(phone, lead)
      }
    }

    await this.saveLeads(toSave)
    return toSave
  }

  async getLeads(ids: string[]): Promise<Lead[]> {
    const store = await this.tx(LEADS_STORE, 'readonly')
    const results: Lead[] = []
    return new Promise((resolve, reject) => {
      let pending = ids.length
      if (pending === 0) {
        resolve([])
        return
      }
      for (const id of ids) {
        const req = store.get(id)
        req.onsuccess = () => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          if (req.result) results.push(req.result as Lead)
          if (--pending === 0) resolve(results)
        }
        req.onerror = () => {
          reject(req.error ?? new Error('IDB request failed'))
        }
      }
    })
  }

  async getAllLeads(): Promise<Lead[]> {
    const store = await this.tx(LEADS_STORE, 'readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(req.result as Lead[])
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async getLeadByPhone(phone: string): Promise<Lead | null> {
    const normalized = normalizePhone(phone)
    const all = await this.getAllLeads()
    return all.find((l) => normalizePhone(l.telefone) === normalized) ?? null
  }

  async deleteLeads(ids: string[]): Promise<void> {
    const db = await this.open()
    const tx = db.transaction([LEADS_STORE, LEAD_META_STORE], 'readwrite')
    const leadsStore = tx.objectStore(LEADS_STORE)
    const metaStore = tx.objectStore(LEAD_META_STORE)
    for (const id of ids) {
      leadsStore.delete(id)
      metaStore.delete(id)
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        resolve()
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('IDB transaction failed'))
      }
    })
  }

  async clearLeads(): Promise<void> {
    const store = await this.tx(LEADS_STORE, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  // Lead Meta
  async saveLeadMeta(meta: LeadMeta): Promise<void> {
    const store = await this.tx(LEAD_META_STORE, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.put(meta)
      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async getLeadMeta(leadId: string): Promise<LeadMeta | undefined> {
    const store = await this.tx(LEAD_META_STORE, 'readonly')
    return new Promise((resolve, reject) => {
      const req = store.get(leadId)
      req.onsuccess = () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(req.result as LeadMeta | undefined)
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async getAllLeadMeta(): Promise<LeadMeta[]> {
    const store = await this.tx(LEAD_META_STORE, 'readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(req.result as LeadMeta[])
      }
      req.onerror = () => {
        reject(req.error ?? new Error('IDB request failed'))
      }
    })
  }

  async updateLeadMetaAfterSend(leadId: string, campaignId: string): Promise<void> {
    const existing = await this.getLeadMeta(leadId)
    const meta: LeadMeta = existing ?? {
      leadId,
      campaignIds: [],
      sentCount: 0,
      responseCount: 0,
      lastContactedAt: '',
      lastResponseAt: '',
    }
    meta.sentCount++
    meta.lastContactedAt = new Date().toISOString()
    if (!meta.campaignIds.includes(campaignId)) {
      meta.campaignIds.push(campaignId)
    }
    await this.saveLeadMeta(meta)
  }

  async updateLeadMetaResponse(leadId: string): Promise<void> {
    const existing = await this.getLeadMeta(leadId)
    const meta: LeadMeta = existing ?? {
      leadId,
      campaignIds: [],
      sentCount: 0,
      responseCount: 0,
      lastContactedAt: '',
      lastResponseAt: '',
    }
    meta.responseCount++
    meta.lastResponseAt = new Date().toISOString()
    await this.saveLeadMeta(meta)
  }
}

const campaignStorage = new CampaignStorage()
export default campaignStorage
