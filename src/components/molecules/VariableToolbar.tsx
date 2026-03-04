import { Component } from 'react'
import { LEAD_FIELDS } from '../../types/Lead'

interface VariableToolbarProps {
  onInsert: (variable: string) => void
}

export default class VariableToolbar extends Component<VariableToolbarProps> {
  override render() {
    return (
      <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-md border border-border">
        <span className="text-xs text-muted-foreground w-full mb-1">
          Clique para inserir variável:
        </span>
        {LEAD_FIELDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              this.props.onInsert(`{${String(key)}}`)
            }}
            className="px-2 py-0.5 text-xs bg-secondary-lighter text-primary rounded hover:opacity-80 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    )
  }
}
