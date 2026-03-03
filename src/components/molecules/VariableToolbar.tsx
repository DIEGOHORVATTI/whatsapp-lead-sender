import { Component } from "react";
import { LEAD_FIELDS } from "../../types/Lead";

interface VariableToolbarProps {
  onInsert: (variable: string) => void;
}

export default class VariableToolbar extends Component<VariableToolbarProps> {
  override render() {
    return (
      <div className="flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
        <span className="text-xs text-slate-500 dark:text-slate-400 w-full mb-1">
          Clique para inserir variável:
        </span>
        {LEAD_FIELDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => this.props.onInsert(`{${key}}`)}
            className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    );
  }
}
