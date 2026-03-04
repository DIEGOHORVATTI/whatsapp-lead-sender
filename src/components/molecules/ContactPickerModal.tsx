import { Component } from 'react'
import type { Lead, LeadMeta } from '../../types/Lead'
import { LEAD_FIELDS } from '../../types/Lead'
import campaignStorage from '../../utils/CampaignStorage'
import { t } from '../../utils/i18n'
import Button from '../atoms/Button'
import { ControlSelect } from '../atoms/ControlFactory'

interface ContactPickerModalProps {
  onSelect: (leads: Lead[]) => void
  onClose: () => void
}

interface ContactPickerModalState {
  leads: Lead[]
  meta: Map<string, LeadMeta>
  loading: boolean
  filters: Record<string, string>
  search: string
  selectedIds: Set<string>
}

const FILTERABLE_FIELDS = ['segmento', 'cidade', 'uf', 'porte', 'bairro', 'cnae'] as const

export default class ContactPickerModal extends Component<
  ContactPickerModalProps,
  ContactPickerModalState
> {
  constructor(props: ContactPickerModalProps) {
    super(props)
    this.state = {
      leads: [],
      meta: new Map(),
      loading: true,
      filters: {},
      search: '',
      selectedIds: new Set(),
    }
  }

  override componentDidMount() {
    void this.load()
  }

  private async load() {
    const [leads, metaList] = await Promise.all([
      campaignStorage.getAllLeads(),
      campaignStorage.getAllLeadMeta(),
    ])
    const meta = new Map<string, LeadMeta>()
    for (const m of metaList) meta.set(m.leadId, m)
    const allIds = new Set(leads.map((l) => l.id))
    this.setState({ leads, meta, loading: false, selectedIds: allIds })
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
          lead.telefone.includes(s)
        if (!match) return false
      }
      const filterKeys = Object.keys(filters)
      for (const field of filterKeys) {
        if (filters[field] && lead[field] !== filters[field]) return false
      }
      return true
    })
  }

  private toggleAll = () => {
    const filtered = this.getFilteredLeads()
    const filteredIds = new Set(filtered.map((l) => l.id))
    const { selectedIds } = this.state
    const allSelected = filtered.every((l) => selectedIds.has(l.id))

    const next = new Set(selectedIds)
    if (allSelected) {
      filteredIds.forEach((id) => next.delete(id))
    } else {
      filteredIds.forEach((id) => next.add(id))
    }
    this.setState({ selectedIds: next })
  }

  private toggleOne = (id: string) => {
    const next = new Set(this.state.selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    this.setState({ selectedIds: next })
  }

  private handleApply = () => {
    const { leads, selectedIds } = this.state
    const selected = leads.filter((l) => selectedIds.has(l.id))
    this.props.onSelect(selected)
  }

  override render() {
    const { onClose } = this.props
    const { loading, filters, search, selectedIds } = this.state
    const filtered = this.getFilteredLeads()
    const activeFilters = Object.keys(filters).filter((k) => filters[k])

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card border border-border rounded-lg shadow-xl w-[95%] max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-semibold">{t('select_saved_contacts')}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : this.state.leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('no_contacts_import_csv')}
            </div>
          ) : (
            <>
              <div className="p-3 flex flex-col gap-2">
                {/* Search + toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t('search')}
                    value={search}
                    onChange={(e) => {
                      this.setState({ search: e.target.value })
                    }}
                    className="flex-1 px-2 py-1.5 text-xs border border-input rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
                  />
                  <Button variant="light" onClick={this.toggleAll} className="text-xs">
                    {filtered.every((l) => selectedIds.has(l.id)) ? t('deselect_all') : t('select_all')}
                  </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  {FILTERABLE_FIELDS.map((field) => {
                    const values = this.getUniqueValues(field)
                    if (values.length === 0) return null
                    const label = LEAD_FIELDS.find((f) => f.key === field)?.label ?? field
                    return (
                      <ControlSelect
                        key={field}
                        value={filters[field] ?? ''}
                        onChange={(e) => {
                          this.setState({ filters: { ...filters, [field]: e.target.value } })
                        }}
                        className="text-xs"
                      >
                        <option value="">{`${label}: ${t('all')}`}</option>
                        {values.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </ControlSelect>
                    )
                  })}
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
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-auto flex-1 border-t border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-1.5 w-8"></th>
                      <th className="p-1.5 text-left">{t('name')}</th>
                      <th className="p-1.5 text-left">{t('decision_maker')}</th>
                      <th className="p-1.5 text-left">{t('segment')}</th>
                      <th className="p-1.5 text-left">{t('city')}</th>
                      <th className="p-1.5 text-left">{t('phone_abbr')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 300).map((lead) => (
                      <tr
                        key={lead.id}
                        className={`border-t border-border hover:bg-muted/50 cursor-pointer ${
                          selectedIds.has(lead.id) ? '' : 'opacity-40'
                        }`}
                        onClick={() => {
                          this.toggleOne(lead.id)
                        }}
                      >
                        <td className="p-1.5 text-center">
                          <input type="checkbox" checked={selectedIds.has(lead.id)} readOnly />
                        </td>
                        <td className="p-1.5 truncate max-w-24">{lead.nome_fantasia}</td>
                        <td className="p-1.5 truncate max-w-20">{lead.decisor}</td>
                        <td className="p-1.5 truncate max-w-20">{lead.segmento}</td>
                        <td className="p-1.5 truncate max-w-16">
                          {lead.cidade}
                          {lead.uf ? `/${lead.uf}` : ''}
                        </td>
                        <td className="p-1.5 font-mono">{lead.telefone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} {t('of')} {this.state.leads.length} {t('selected')}
            </span>
            <div className="flex gap-2">
              <Button variant="light" onClick={onClose} className="text-xs">
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={this.handleApply}
                disabled={selectedIds.size === 0}
                className="text-xs"
              >
                {`${t('select')} ${selectedIds.size} ${t('contacts')}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
