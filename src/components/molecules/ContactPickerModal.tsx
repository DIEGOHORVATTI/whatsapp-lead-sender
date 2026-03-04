import { Component } from 'react'
import type { Lead, LeadMeta } from '../../types/Lead'
import { LEAD_FIELDS, toTitleCase } from '../../types/Lead'
import campaignStorage from '../../utils/CampaignStorage'
import { t } from '../../utils/i18n'
import Button from '../atoms/Button'
import SelectMultiAutoComplete from '../atoms/SelectMultiAutoComplete'

interface ContactPickerModalProps {
  onSelect: (leads: Lead[]) => void
  onClose: () => void
}

interface ContactPickerModalState {
  leads: Lead[]
  meta: Map<string, LeadMeta>
  loading: boolean
  filters: Record<string, string[]>
  search: string
  selectedIds: Set<string>
  linhaFrom: string
  linhaTo: string
}

const FILTERABLE_FIELDS = [
  'segmento',
  'cidade',
  'uf',
  'porte',
  'bairro',
  'cnae',
  'cargo',
  'dias_abertura',
] as const

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13) {
    // +55 11 99999-9999
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    // +55 11 9999-9999
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 11) {
    // (11) 99999-9999
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    // (11) 9999-9999
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

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
      linhaFrom: '',
      linhaTo: '',
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
    const { leads, search, filters, linhaFrom, linhaTo } = this.state
    const s = search.toLowerCase()

    // Apply linha (row range) filter first
    let filtered = leads
    const from = linhaFrom ? parseInt(linhaFrom, 10) : 0
    const to = linhaTo ? parseInt(linhaTo, 10) : leads.length - 1
    if (linhaFrom || linhaTo) {
      filtered = filtered.filter((_, idx) => idx >= from && idx <= to)
    }

    return filtered.filter((lead) => {
      if (s) {
        const match =
          lead.nome_fantasia.toLowerCase().includes(s) ||
          lead.decisor.toLowerCase().includes(s) ||
          lead.telefone.includes(s)
        if (!match) return false
      }
      const filterKeys = Object.keys(filters)
      for (const field of filterKeys) {
        const vals = filters[field]
        if (vals && vals.length > 0) {
          const leadVal = lead[field]?.trim() ?? ''
          if (!vals.includes(leadVal)) return false
        }
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

  private getApplicableLeads(): Lead[] {
    const filtered = this.getFilteredLeads()
    return filtered.filter((l) => this.state.selectedIds.has(l.id))
  }

  private handleApply = () => {
    this.props.onSelect(this.getApplicableLeads())
  }

  private clearFilters = () => {
    this.setState({ filters: {}, linhaFrom: '', linhaTo: '' })
  }

  override render() {
    const { onClose } = this.props
    const { loading, filters, search, selectedIds, linhaFrom, linhaTo } = this.state
    const filtered = this.getFilteredLeads()
    const applicableCount = filtered.filter((l) => selectedIds.has(l.id)).length
    const hasActiveFilters =
      Object.keys(filters).some((k) => filters[k] && filters[k].length > 0) || linhaFrom || linhaTo

    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
          <h3 className="text-sm font-semibold flex-1">{t('select_saved_contacts')}</h3>
          <span className="text-[10px] text-muted-foreground">
            {applicableCount} {t('of')} {filtered.length} {t('selected')}
          </span>
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
                  {filtered.every((l) => selectedIds.has(l.id))
                    ? t('deselect_all')
                    : t('select_all')}
                </Button>
              </div>

              {/* Filters - 2 per row grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {FILTERABLE_FIELDS.map((field) => {
                  const values = this.getUniqueValues(field)
                  if (values.length === 0) return null
                  const label = LEAD_FIELDS.find((f) => f.key === field)?.label ?? field
                  return (
                    <SelectMultiAutoComplete
                      key={field}
                      label={label}
                      options={values}
                      selected={filters[field] ?? []}
                      onChange={(selected) => {
                        this.setState({ filters: { ...filters, [field]: selected } })
                      }}
                      className="text-xs"
                    />
                  )
                })}

                {/* Linha (row range) filter */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={this.state.leads.length - 1}
                    placeholder="Linha de"
                    value={linhaFrom}
                    onChange={(e) => {
                      this.setState({ linhaFrom: e.target.value })
                    }}
                    className="w-full bg-muted text-foreground border border-input p-1 rounded-lg text-xs placeholder:text-muted-foreground"
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">{t('to')}</span>
                  <input
                    type="number"
                    min={0}
                    max={this.state.leads.length - 1}
                    placeholder="Linha até"
                    value={linhaTo}
                    onChange={(e) => {
                      this.setState({ linhaTo: e.target.value })
                    }}
                    className="w-full bg-muted text-foreground border border-input p-1 rounded-lg text-xs placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-1 items-center">
                  {Object.keys(filters).map((field) => {
                    const vals = filters[field]
                    if (!vals || vals.length === 0) return null
                    const label = LEAD_FIELDS.find((f) => f.key === field)?.label ?? field
                    return vals.map((v) => (
                      <span
                        key={`${field}-${v}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/80 text-white rounded-full"
                      >
                        {label}: {v}
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...filters, [field]: vals.filter((x) => x !== v) }
                            if (next[field] && next[field].length === 0) {
                              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                              delete next[field]
                            }
                            this.setState({ filters: next })
                          }}
                          className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] hover:bg-white/20 transition-colors"
                        >
                          x
                        </button>
                      </span>
                    ))
                  })}
                  {(linhaFrom || linhaTo) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/80 text-white rounded-full">
                      Linha: {linhaFrom || '0'} - {linhaTo || String(this.state.leads.length - 1)}
                      <button
                        type="button"
                        onClick={() => {
                          this.setState({ linhaFrom: '', linhaTo: '' })
                        }}
                        className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] hover:bg-white/20 transition-colors"
                      >
                        x
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={this.clearFilters}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                  >
                    {t('clear_all')}
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 border-t border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-1.5 w-6 text-center text-[10px] text-muted-foreground">#</th>
                    <th className="p-1.5 w-8"></th>
                    <th className="p-1.5 text-left">{t('name')}</th>
                    <th className="p-1.5 text-left">{t('decision_maker')}</th>
                    <th className="p-1.5 text-left">{t('phone_abbr')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((lead) => {
                    const originalIndex = this.state.leads.indexOf(lead)
                    return (
                      <tr
                        key={lead.id}
                        className={`border-t border-border hover:bg-muted/50 cursor-pointer ${
                          selectedIds.has(lead.id) ? '' : 'opacity-40'
                        }`}
                        onClick={() => {
                          this.toggleOne(lead.id)
                        }}
                      >
                        <td className="p-1.5 text-center text-[10px] text-muted-foreground font-mono">
                          {originalIndex}
                        </td>
                        <td className="p-1.5 text-center">
                          <input type="checkbox" checked={selectedIds.has(lead.id)} readOnly />
                        </td>
                        <td className="p-1.5 truncate max-w-24">
                          {toTitleCase(lead.nome_fantasia)}
                        </td>
                        <td className="p-1.5 truncate max-w-20">{toTitleCase(lead.decisor)}</td>
                        <td className="p-1.5 font-mono text-[11px]">
                          {formatPhoneDisplay(lead.telefone)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border bg-card">
          <span className="text-xs text-muted-foreground">
            {filtered.length} {t('contacts')} | {applicableCount} {t('selected')}
          </span>
          <div className="flex gap-2">
            <Button variant="light" onClick={onClose} className="text-xs">
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={this.handleApply}
              disabled={applicableCount === 0}
              className="text-xs"
            >
              {`${t('select')} ${String(applicableCount)} ${t('contacts')}`}
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
