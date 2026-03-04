import { Component } from 'react'
import { LEAD_FIELDS } from '../../types/Lead'
import { t } from '../../utils/i18n'

const MODIFIERS = [
  { key: '|first', label: '|first', description: 'Primeiro nome' },
  { key: '|upper', label: '|upper', description: 'MAIÚSCULAS' },
  { key: '|lower', label: '|lower', description: 'minúsculas' },
]

interface VariableToolbarProps {
  onInsert: (variable: string) => void
}
export default class VariableToolbar extends Component<VariableToolbarProps> {
  override render() {
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-background rounded-lg border border-border/60 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-full mb-0.5 select-none">
          {t('insert_variable')}
        </span>

        {LEAD_FIELDS.map(({ key, label }) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => {
              this.props.onInsert(String(key))
            }}
            className="
              inline-flex items-center
              px-2.5 py-0.5
              text-[11px] font-semibold
              rounded-md
              bg-primary/10 text-primary
              border border-primary/20
              hover:bg-primary/20
              active:scale-95
              transition-all duration-150
              cursor-pointer select-none
            "
          >
            {`{{${label}}}`}
          </button>
        ))}

        <span className="text-[10px] text-muted-foreground/60 w-full mt-1 mb-0.5 select-none">
          Modificadores: {'{campo|first}'} = primeiro nome, {'{campo|upper}'} = MAIÚSCULAS,{' '}
          {'{campo|lower}'} = minúsculas
        </span>

        {MODIFIERS.map((mod) => (
          <button
            key={mod.key}
            type="button"
            onClick={() => {
              this.props.onInsert(mod.key)
            }}
            className="
              inline-flex items-center
              px-2.5 py-0.5
              text-[10px] font-medium
              rounded-md
              bg-muted text-muted-foreground
              border border-border
              hover:bg-accent
              active:scale-95
              transition-all duration-150
              cursor-pointer select-none
            "
            title={mod.description}
          >
            {mod.label}
          </button>
        ))}
      </div>
    )
  }
}
