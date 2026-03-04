import { Component } from 'react'
import type { Lead, LeadMeta } from '../../types/Lead'
import { LEAD_FIELDS, toTitleCase } from '../../types/Lead'
import campaignStorage from '../../utils/CampaignStorage'
import { t } from '../../utils/i18n'
import Button from '../atoms/Button'
import { ControlSelect } from '../atoms/ControlFactory'

interface ContactsTabState {
  leads: Lead[]
  meta: Map<string, LeadMeta>
  loading: boolean
  search: string
  filters: Record<string, string>
  selectedIds: Set<string>
  showFilters: boolean
}

const FILTERABLE_FIELDS = ['segmento', 'cidade', 'uf', 'porte', 'bairro'] as const

export default class ContactsTab extends Component<Record<string, never>, ContactsTabState> {
  constructor(props: Record<string, never>) {
    super(props)
    this.state = {
      leads: [],
      meta: new Map(),
      loading: true,
      search: '',
      filters: {},
      selectedIds: new Set(),
      showFilters: false,
    }
  }

  override componentDidMount() {
    void this.loadData()
  }

  private async loadData() {
    this.setState({ loading: true })
    const [leads, metaList] = await Promise.all([
      campaignStorage.getAllLeads(),
      campaignStorage.getAllLeadMeta(),
    ])
    const meta = new Map<string, LeadMeta>()
    for (const m of metaList) {
      meta.set(m.leadId, m)
    }
    this.setState({ leads, meta, loading: false })
  }

  private getUniqueValues(field: string): string[] {
    const values = new Set<string>()
    for (const lead of this.state.leads) {
      const val = lead[field]
      if (val?.trim()) values.add(val.trim())
    }
    return Array.from(values).sort()
  }

  private getFilteredLeads(): Lead[] {
    const { leads, search, filters } = this.state
    const s = search.toLowerCase()
    return leads.filter((lead) => {
      if (s) {
        const match =
          lead.nome_fantasia.toLowerCase().includes(s) ||
          lead.decisor.toLowerCase().includes(s) ||
          lead.telefone.includes(s) ||
          lead.segmento.toLowerCase().includes(s)
        if (!match) return false
      }
      const filterKeys = Object.keys(filters)
      for (const field of filterKeys) {
        if (filters[field] && lead[field] !== filters[field]) return false
      }
      return true
    })
  }

  private toggleSelect = (id: string) => {
    const selected = new Set(this.state.selectedIds)
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
    this.setState({ selectedIds: selected })
  }

  private handleDelete = async () => {
    const { selectedIds } = this.state
    if (selectedIds.size === 0) return
    await campaignStorage.deleteLeads(Array.from(selectedIds))
    this.setState({ selectedIds: new Set() })
    await this.loadData()
  }

  override render() {
    const { meta, loading, search, filters, selectedIds, showFilters } = this.state
    const filtered = this.getFilteredLeads()
    const activeFilters = Object.keys(filters).filter((k) => filters[k])

    // KPIs
    let totalSent = 0
    let totalResponses = 0
    const campaignSet = new Set<string>()
    meta.forEach((m) => {
      totalSent += m.sentCount
      totalResponses += m.responseCount
      m.campaignIds.forEach((c) => campaignSet.add(c))
    })

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t('loading_contacts')}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3 p-3">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t('contacts_label'), value: this.state.leads.length },
            { label: t('sent'), value: totalSent },
            { label: t('responses'), value: totalResponses },
            { label: t('campaigns'), value: campaignSet.size },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-foreground">{value}</div>
              <div className="text-[10px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('search_contacts')}
            value={search}
            onChange={(e) => {
              this.setState({ search: e.target.value })
            }}
            className="flex-1 px-2 py-1.5 text-xs border border-input rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
          />
          <Button
            variant={showFilters ? 'primary' : 'light'}
            onClick={() => {
              this.setState({ showFilters: !showFilters })
            }}
            className="text-xs"
          >
            {t('filters')} {activeFilters.length > 0 ? `(${String(activeFilters.length)})` : ''}
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="danger" onClick={() => void this.handleDelete()} className="text-xs">
              {t('delete')} ({selectedIds.size})
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeFilters.map((field) => {
              const label = LEAD_FIELDS.find((f) => f.key === field)?.label ?? field
              return (
                <span
                  key={field}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/80 text-white rounded-full"
                >
                  {label}: {filters[field]}
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...filters }
                      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                      delete next[field]
                      this.setState({ filters: next })
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] hover:bg-white/20 transition-colors"
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={() => {
                this.setState({ filters: {} })
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              {t('clear_all')}
            </button>
          </div>
        )}

        {/* Inline filters */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded-lg">
            {FILTERABLE_FIELDS.map((field) => {
              const values = this.getUniqueValues(field)
              if (values.length === 0) return null
              const label = LEAD_FIELDS.find((f) => f.key === field)?.label ?? field
              return (
                <div key={field} className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-muted-foreground">{label}</label>
                  <ControlSelect
                    value={filters[field] ?? ''}
                    onChange={(e) => {
                      this.setState({ filters: { ...filters, [field]: e.target.value } })
                    }}
                    className="text-xs"
                  >
                    <option value="">{t('all')}</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </ControlSelect>
                </div>
              )
            })}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          {filtered.length} {t('contacts')}
          {filtered.length !== this.state.leads.length
            ? ` (de ${String(this.state.leads.length)})`
            : ''}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {this.state.leads.length === 0 ? t('no_contacts_saved') : t('no_contacts_filtered')}
          </div>
        ) : (
          <div className="overflow-auto max-h-[50vh] border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-1.5 w-8"></th>
                  <th className="p-1.5 text-left">{t('name')}</th>
                  <th className="p-1.5 text-left">{t('decision_maker')}</th>
                  <th className="p-1.5 text-left">{t('segment')}</th>
                  <th className="p-1.5 text-left">{t('city')}</th>
                  <th className="p-1.5 text-left">{t('phone_abbr')}</th>
                  <th className="p-1.5 text-center">{t('sent_abbr_table')}</th>
                  <th className="p-1.5 text-center">{t('response_abbr')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((lead) => {
                  const m = meta.get(lead.id)
                  return (
                    <tr
                      key={lead.id}
                      className={`border-t border-border hover:bg-muted/50 cursor-pointer ${
                        selectedIds.has(lead.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        this.toggleSelect(lead.id)
                      }}
                    >
                      <td className="p-1.5 text-center">
                        <input type="checkbox" checked={selectedIds.has(lead.id)} readOnly />
                      </td>
                      <td className="p-1.5 truncate max-w-24">{toTitleCase(lead.nome_fantasia)}</td>
                      <td className="p-1.5 truncate max-w-20">{toTitleCase(lead.decisor)}</td>
                      <td className="p-1.5 truncate max-w-20">{toTitleCase(lead.segmento)}</td>
                      <td className="p-1.5 truncate max-w-16">
                        {toTitleCase(lead.cidade)}
                        {lead.uf ? `/${lead.uf}` : ''}
                      </td>
                      <td className="p-1.5 font-mono">{lead.telefone}</td>
                      <td className="p-1.5 text-center">{m?.sentCount ?? 0}</td>
                      <td className="p-1.5 text-center">
                        {m?.responseCount ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {m.responseCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
}
