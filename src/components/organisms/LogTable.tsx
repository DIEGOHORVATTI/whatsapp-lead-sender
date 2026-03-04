import { Component } from 'react'
import { t } from '../../utils/i18n'
import type Log from 'types/Log'

const LOG_COLORS: Record<number, string> = {
  1: 'border-l-destructive bg-red-50 dark:bg-red-900/20',
  2: 'border-l-warning bg-yellow-50 dark:bg-yellow-900/20',
  3: 'border-l-success bg-green-50 dark:bg-green-900/20',
}

export default class LogTable extends Component<{ className?: string }, { logs: Log[] }> {
  private storageListener?: (changes: Record<string, chrome.storage.StorageChange>) => void

  constructor(props: { className?: string }) {
    super(props)
    this.state = { logs: [] }
  }

  override componentDidMount() {
    this.loadLogs()
    this.storageListener = (changes) => {
      if (changes['logs']) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newLogs = (changes['logs'].newValue ?? []) as Log[]
        this.setState({ logs: newLogs })
      }
    }
    chrome.storage.onChanged.addListener(this.storageListener)
  }

  override componentWillUnmount() {
    if (this.storageListener) {
      chrome.storage.onChanged.removeListener(this.storageListener)
    }
  }

  private loadLogs() {
    chrome.storage.local.get((data: { logs?: Log[] }) => {
      this.setState({ logs: data.logs ?? [] })
    })
  }

  private handleClear = () => {
    void chrome.storage.local.set({ logs: [] })
    this.setState({ logs: [] })
  }

  override render() {
    const { logs } = this.state

    return (
      <div className={`flex flex-col gap-2 ${this.props.className ?? ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('logs')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {logs.length} {logs.length !== 1 ? t('events') : t('event')}
            </span>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={this.handleClear}
                className="text-[10px] text-destructive hover:underline"
              >
                {t('clear')}
              </button>
            )}
          </div>
        </div>

        {/* Log entries */}
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <div className="text-2xl opacity-30">📋</div>
            <p className="text-xs text-muted-foreground">{t('no_events_logged')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-[calc(100vh-120px)] overflow-y-auto">
            {[...logs].reverse().map((log, i) => (
              <div
                key={i}
                className={`border-l-2 rounded-r px-2 py-1.5 text-xs ${LOG_COLORS[log.level] ?? 'border-l-border'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {log.contact || '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {log.date ?? ''}
                  </span>
                </div>
                <p className="text-foreground mt-0.5 break-words">{log.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Version */}
        <p className="text-[10px] text-muted-foreground text-center mt-auto pt-2">
          v{chrome.runtime.getManifest().version}
        </p>
      </div>
    )
  }
}
