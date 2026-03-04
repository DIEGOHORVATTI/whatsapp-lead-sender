import { Component, createRef, type RefObject } from 'react'
import type { Lead } from '../../types/Lead'
import { LEAD_FIELDS } from '../../types/Lead'
import { autoMapColumns, mapRowsToLeads, parseCSV } from '../../utils/csvParser'
import { ControlSelect } from '../atoms/ControlFactory'

interface ContactInputProps {
  onLeadsChange: (leads: Lead[]) => void
}

interface ContactInputState {
  mode: 'manual' | 'csv'
  manualText: string
  csvHeaders: string[]
  csvRows: Record<string, string>[]
  mapping: Record<string, string>
  csvError?: string
  showMapping: boolean
}

export default class ContactInput extends Component<ContactInputProps, ContactInputState> {
  private fileRef: RefObject<HTMLInputElement> = createRef<HTMLInputElement>()

  constructor(props: ContactInputProps) {
    super(props)
    this.state = {
      mode: 'csv',
      manualText: '',
      csvHeaders: [],
      csvRows: [],
      mapping: {},
      showMapping: false,
    }
  }

  private handleManualChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value.replace(/[^\d\n\t,;+]*/g, '')
    this.setState({ manualText: text })
    const numbers = text
      .split(/[\n\t,;]/)
      .map((s) => s.trim().replace(/\D/g, ''))
      .filter(Boolean)
    const leads: Lead[] = numbers.map((phone, i) => ({
      id: String(i),
      telefone: phone,
      telefone_2: '',
      nome_fantasia: '',
      decisor: '',
      cargo: '',
      email: '',
      segmento: '',
      cnae: '',
      razao_social: '',
      cnpj: '',
      porte: '',
      capital_social: '',
      dias_abertura: '',
      data_inicio_atividade: '',
      cidade: '',
      uf: '',
      bairro: '',
      endereco: '',
      cep: '',
    }))
    this.props.onLeadsChange(leads)
  }

  private handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { headers, rows } = parseCSV(String(reader.result))
        if (headers.length === 0) {
          this.setState({ csvError: 'CSV vazio ou inválido' })
          return
        }
        const mapping = autoMapColumns(headers)
        this.setState(
          {
            csvHeaders: headers,
            csvRows: rows,
            mapping,
            csvError: undefined,
            showMapping: false,
          },
          () => {
            this.applyCSVMapping()
          }
        )
      } catch {
        this.setState({ csvError: 'Erro ao ler CSV' })
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  private handleMappingChange = (csvCol: string, leadField: string) => {
    const oldMapping = this.state.mapping
    const mapping: Record<string, string> = {}
    for (const [key, value] of Object.entries(oldMapping)) {
      if (key === csvCol || value === leadField) continue
      mapping[key] = value
    }
    if (leadField) {
      mapping[csvCol] = leadField
    }
    this.setState({ mapping }, () => {
      this.applyCSVMapping()
    })
  }

  private applyCSVMapping() {
    const { csvRows, mapping } = this.state
    const leads = mapRowsToLeads(csvRows, mapping)
    this.props.onLeadsChange(leads)
  }

  override render() {
    const { mode, manualText, csvHeaders, csvRows, mapping, csvError, showMapping } = this.state

    return (
      <div className="flex flex-col gap-2">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                this.setState({ mode: 'manual' })
              }}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === 'manual'
                  ? 'bg-card shadow-sm font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Digitar números
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ mode: 'csv' })
              }}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === 'csv'
                  ? 'bg-card shadow-sm font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Importar CSV
            </button>
          </div>

          {mode === 'csv' && csvRows.length > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400">
              {csvRows.length} leads carregados
            </span>
          )}
          {mode === 'manual' && manualText.trim() && (
            <span className="text-xs text-green-600 dark:text-green-400">
              {manualText.split(/[\n\t,;]/).filter((s) => s.trim()).length} contatos
            </span>
          )}
        </div>

        {/* Manual Mode */}
        {mode === 'manual' && (
          <textarea
            value={manualText}
            onChange={this.handleManualChange}
            placeholder="Cole os números, um por linha (ex: 5511999999999)"
            rows={3}
            className="w-full bg-muted text-foreground border border-input p-2 rounded-lg text-sm focus:shadow-equal focus:shadow-ring focus:outline-none transition-shadow placeholder:text-muted-foreground"
          />
        )}

        {/* CSV Mode */}
        {mode === 'csv' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                ref={this.fileRef as React.LegacyRef<HTMLInputElement>}
                type="file"
                accept=".csv,.txt"
                onChange={this.handleCSVFile}
                className="text-xs text-foreground"
              />
              {csvHeaders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    this.setState({ showMapping: !showMapping })
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {showMapping ? 'Ocultar mapeamento' : 'Ajustar mapeamento'}
                </button>
              )}
            </div>
            {csvError && <div className="text-xs text-destructive">{csvError}</div>}

            {/* Mapping (collapsible) */}
            {showMapping && csvHeaders.length > 0 && (
              <div className="border border-border rounded p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {csvHeaders.map((h) => (
                    <div key={h} className="flex items-center gap-1.5">
                      <span className="text-[11px] w-28 truncate text-muted-foreground" title={h}>
                        {h}
                      </span>
                      <ControlSelect
                        value={mapping[h] ?? ''}
                        onChange={(e) => {
                          this.handleMappingChange(h, e.target.value)
                        }}
                        className="text-[11px] py-0.5"
                      >
                        <option value="">— ignorar —</option>
                        {LEAD_FIELDS.map(({ key, label }) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </ControlSelect>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
}
