import type { Campaign, CampaignResult } from '../types/Campaign'
import type { Lead } from '../types/Lead'

const DB_NAME = 'WTFCampaignDB'
const DB_VERSION = 1
const CAMPAIGNS_STORE = 'campaigns'
const LEADS_STORE = 'leads'

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
}

const campaignStorage = new CampaignStorage()
export default campaignStorage
