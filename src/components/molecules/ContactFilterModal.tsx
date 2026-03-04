import { Component } from 'react'
import type { Lead, LeadMeta } from '../../types/Lead'
import { LEAD_FIELDS } from '../../types/Lead'
import Button from '../atoms/Button'
import { ControlSelect } from '../atoms/ControlFactory'

interface ContactFilterModalProps {
  leads: Lead[]
  meta: Map<string, LeadMeta>
  onApply: (filteredLeads: Lead[]) => void
  onClose: () => void
}

interface ContactFilterModalState {
  filters: Record<string, string>
  search: string
}

const FILTERABLE_FIELDS = ['segmento', 'cidade', 'uf', 'porte', 'bairro', 'cnae', 'cargo'] as const

export default class ContactFilterModal extends Component<
  ContactFilterModalProps,
  ContactFilterModalState
> {
  constructor(props: ContactFilterModalProps) {
    super(props)
    this.state = { filters: {}, search: '' }
  }

  private getUniqueValues(field: string): string[] {
    const values = new Set<string>()
    for (const lead of this.props.leads) {
      const val = lead[field]
      if (val?.trim()) values.add(val.trim())
    }
    return Array.from(values).sort()
  }

  private getFilteredLeads(): Lead[] {
    const { leads } = this.props
    const { filters, search } = this.state
    const searchLower = search.toLowerCase()

    return leads.filter((lead) => {
      // Text search
      if (searchLower) {
        const matchesSearch =
          lead.nome_fantasia.toLowerCase().includes(searchLower) ||
          lead.decisor.toLowerCase().includes(searchLower) ||
          lead.telefone.includes(searchLower)
        if (!matchesSearch) return false
      }
      // Field filters
      const filterKeys = Object.keys(filters)
      for (const field of filterKeys) {
        const value = filters[field]
        if (value && lead[field] !== value) return false
      }
      return true
    })
  }

  override render() {
    const { onApply, onClose } = this.props
    const { filters, search } = this.state
    const filtered = this.getFilteredLeads()
    const activeFilters = Object.keys(filters).filter((k) => filters[k])

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card border border-border rounded-lg shadow-xl w-[90%] max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-semibold">Filtrar Contatos</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
            {/* Search */}
            <input
              type="text"
              placeholder="Buscar nome, decisor, telefone..."
              value={search}
              onChange={(e) => {
                this.setState({ search: e.target.value })
              }}
              className="px-2 py-1.5 text-xs border border-input rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
            />

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

            {/* Field filters */}
            <div className="grid grid-cols-2 gap-2">
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
                        this.setState({
                          filters: { ...filters, [field]: e.target.value },
                        })
                      }}
                      className="text-xs"
                    >
                      <option value="">Todos</option>
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
          </div>

          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filtered.length} contatos encontrados
            </span>
            <div className="flex gap-2">
              <Button
                variant="light"
                onClick={() => {
                  this.setState({ filters: {}, search: '' })
                }}
                className="text-xs"
              >
                Limpar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onApply(filtered)
                }}
                className="text-xs"
              >
                Aplicar ({filtered.length})
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
