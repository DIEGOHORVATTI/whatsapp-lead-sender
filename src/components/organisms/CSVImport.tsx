import { Component, createRef, type RefObject } from 'react'
import type { Lead } from '../../types/Lead'
import { LEAD_FIELDS } from '../../types/Lead'
import { autoMapColumns, mapRowsToLeads, parseCSV } from '../../utils/csvParser'
import Button from '../atoms/Button'
import { ControlSelect } from '../atoms/ControlFactory'
import Box from '../molecules/Box'

interface CSVImportProps {
  onImport: (leads: Lead[]) => void
}

interface CSVImportState {
  step: 'upload' | 'map' | 'preview'
  headers: string[]
  allRows: Record<string, string>[]
  rows: Record<string, string>[]
  mapping: Record<string, string>
  selectedRows: Set<number>
  search: string
  lineStart: string
  lineEnd: string
  error?: string
}

export default class CSVImport extends Component<CSVImportProps, CSVImportState> {
  private fileRef: RefObject<HTMLInputElement> = createRef<HTMLInputElement>()

  constructor(props: CSVImportProps) {
    super(props)
    this.state = {
      step: 'upload',
      headers: [],
      allRows: [],
      rows: [],
      mapping: {},
      selectedRows: new Set(),
      search: '',
      lineStart: '0',
      lineEnd: '',
    }
  }

  private handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const text = reader.result as string
        const { headers, rows } = parseCSV(text)
        if (headers.length === 0) {
          this.setState({ error: 'CSV vazio ou inválido' })
          return
        }
        const mapping = autoMapColumns(headers)
        const allSelected = new Set(rows.map((_: Record<string, string>, i: number) => i))
        this.setState({
          step: 'map',
          headers,
          allRows: rows,
          rows,
          mapping,
          selectedRows: allSelected,
          lineStart: '0',
          lineEnd: String(rows.length),
          error: undefined,
        })
      } catch {
        this.setState({ error: 'Erro ao ler CSV' })
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  private applyRange = () => {
    const { allRows, lineStart, lineEnd } = this.state
    const start = Math.max(0, parseInt(lineStart, 10) || 0)
    const end = lineEnd
      ? Math.min(allRows.length, parseInt(lineEnd, 10) || allRows.length)
      : allRows.length
    const rows = allRows.slice(start, end)
    const allSelected = new Set(rows.map((_: Record<string, string>, i: number) => i))
    this.setState({ rows, selectedRows: allSelected })
  }

  private handleMappingChange = (csvCol: string, leadField: string) => {
    const mapping = { ...this.state.mapping }
    // Remove previous mapping to this leadField
    const keys = Object.keys(mapping)
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      if (mapping[key] === leadField && key !== csvCol) delete mapping[key]
    }
    if (leadField) {
      mapping[csvCol] = leadField
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete mapping[csvCol]
    }
    this.setState({ mapping })
  }

  private toggleRow = (idx: number) => {
    const selected = new Set(this.state.selectedRows)
    if (selected.has(idx)) selected.delete(idx)
    else selected.add(idx)
    this.setState({ selectedRows: selected })
  }

  private toggleAll = () => {
    const { rows, selectedRows } = this.state
    if (selectedRows.size === rows.length) {
      this.setState({ selectedRows: new Set() })
    } else {
      this.setState({
        selectedRows: new Set(rows.map((_: Record<string, string>, i: number) => i)),
      })
    }
  }

  private handleImport = () => {
    const { rows, mapping, selectedRows } = this.state
    const selectedData = rows.filter((_: Record<string, string>, i: number) => selectedRows.has(i))
    const leads = mapRowsToLeads(selectedData, mapping)
    this.props.onImport(leads)
  }

  private getFilteredRows(): { row: Record<string, string>; idx: number }[] {
    const { rows, search } = this.state
    const s = search.toLowerCase()
    return rows
      .map((row: Record<string, string>, idx: number) => ({ row, idx }))
      .filter(({ row }) => {
        if (!s) return true
        const vals = Object.keys(row)
        return vals.some((k) => (row[k] ?? '').toLowerCase().includes(s))
      })
  }

  override render() {
    const { step, headers, mapping, selectedRows, search, error } = this.state

    return (
      <Box title="Importar CSV de Leads">
        <div className="p-4 flex flex-col gap-4">
          {error && (
            <div className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Upload */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                ref={this.fileRef as React.LegacyRef<HTMLInputElement>}
                type="file"
                accept=".csv,.txt"
                onChange={this.handleFile}
                className="text-sm"
              />
              {step !== 'upload' && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {this.state.allRows.length} linhas no arquivo
                </span>
              )}
            </div>
            {step !== 'upload' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Linhas:</span>
                <input
                  type="number"
                  min="0"
                  max={this.state.allRows.length}
                  value={this.state.lineStart}
                  onChange={(e) => {
                    this.setState({ lineStart: e.target.value })
                  }}
                  placeholder="0"
                  className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900"
                />
                <span className="text-xs text-slate-500">até</span>
                <input
                  type="number"
                  min="0"
                  max={this.state.allRows.length}
                  value={this.state.lineEnd}
                  onChange={(e) => {
                    this.setState({ lineEnd: e.target.value })
                  }}
                  placeholder={String(this.state.allRows.length)}
                  className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900"
                />
                <Button variant="light" onClick={this.applyRange} className="text-xs">
                  Aplicar
                </Button>
                <span className="text-xs text-slate-500">
                  ({this.state.rows.length} selecionadas)
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Column Mapping */}
          {(step === 'map' || step === 'preview') && (
            <>
              <div className="border border-slate-200 dark:border-slate-700 rounded p-3">
                <h3 className="text-sm font-semibold mb-2">Mapeamento de Colunas</h3>
                <div className="grid grid-cols-2 gap-2">
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-xs w-32 truncate" title={h}>
                        {h}
                      </span>
                      <ControlSelect
                        value={mapping[h] ?? ''}
                        onChange={(e) => {
                          this.handleMappingChange(h, e.target.value)
                        }}
                        className="text-xs"
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
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      this.setState({ step: 'preview' })
                    }}
                    className="text-sm"
                  >
                    Pré-visualizar
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Preview & Select */}
          {step === 'preview' && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    this.setState({ search: e.target.value })
                  }}
                  className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900"
                />
                <Button variant="light" onClick={this.toggleAll} className="text-xs">
                  {selectedRows.size === this.state.rows.length
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </Button>
                <span className="text-xs text-slate-500">{selectedRows.size} selecionados</span>
              </div>
              <div className="overflow-auto max-h-64 border border-slate-200 dark:border-slate-700 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="p-1 w-8"></th>
                      <th className="p-1 text-left">Fantasia</th>
                      <th className="p-1 text-left">Decisor</th>
                      <th className="p-1 text-left">Segmento</th>
                      <th className="p-1 text-left">Telefone</th>
                      <th className="p-1 text-left">Cidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {this.getFilteredRows()
                      .slice(0, 100)
                      .map(({ row, idx }) => {
                        const mapped: Record<string, string> = {}
                        const mappingKeys = Object.keys(mapping)
                        for (const csvCol of mappingKeys) {
                          const leadField = mapping[csvCol]
                          if (leadField) {
                            mapped[leadField] = row[csvCol] ?? ''
                          }
                        }
                        return (
                          <tr
                            key={idx}
                            className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 ${
                              !selectedRows.has(idx) ? 'opacity-40' : ''
                            }`}
                            onClick={() => {
                              this.toggleRow(idx)
                            }}
                          >
                            <td className="p-1 text-center">
                              <input type="checkbox" checked={selectedRows.has(idx)} readOnly />
                            </td>
                            <td className="p-1 truncate max-w-32">{mapped['nome_fantasia']}</td>
                            <td className="p-1 truncate max-w-24">{mapped['decisor']}</td>
                            <td className="p-1 truncate max-w-24">{mapped['segmento']}</td>
                            <td className="p-1">{mapped['telefone']}</td>
                            <td className="p-1">{mapped['cidade']}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
              <Button
                variant="success"
                onClick={this.handleImport}
                disabled={selectedRows.size === 0}
                className="text-sm"
              >
                Importar {selectedRows.size} leads
              </Button>
            </>
          )}
        </div>
      </Box>
    )
  }
}
