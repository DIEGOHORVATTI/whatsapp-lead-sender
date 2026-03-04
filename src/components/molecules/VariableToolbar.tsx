import { Component } from 'react'
import { LEAD_FIELDS } from '../../types/Lead'
import { t } from '../../utils/i18n'

const VIRTUAL_VARIABLES = [{ key: 'primeiro_nome', label: 'Primeiro Nome' }]

interface VariableToolbarProps {
  onInsert: (variable: string) => void
}
export default class VariableToolbar extends Component<VariableToolbarProps> {
  override render() {
    const allFields = [
      ...LEAD_FIELDS.map(({ key, label }) => ({ key: String(key), label })),
      ...VIRTUAL_VARIABLES,
    ]
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-background rounded-lg border border-border/60 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-full mb-0.5 select-none">
          {t('insert_variable')}
        </span>

        {allFields.map(({ key, label }) => (
          <button
            key={key}
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
      </div>
    )
  }
}
