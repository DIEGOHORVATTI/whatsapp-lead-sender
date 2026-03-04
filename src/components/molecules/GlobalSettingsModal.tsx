import { Component } from 'react'
import { I18nContext, getAvailableLocales, t } from '../../utils/i18n'

interface GlobalSettingsModalProps {
  open: boolean
  onClose: () => void
}

interface GlobalSettingsModalState {
  theme: 'system' | 'light' | 'dark'
  dailyLimit: number
}

const THEME_KEY = 'wtf_theme'
const DAILY_LIMIT_KEY = 'wtf_global_daily_limit'

function applyTheme(theme: 'system' | 'light' | 'dark') {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else if (theme === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
  } else {
    root.classList.remove('light', 'dark')
  }
}

export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') {
      applyTheme(saved)
      return saved
    }
  } catch {
    // ignore
  }
  return 'system' as const
}

export function getGlobalDailyLimit(): number {
  try {
    const val = localStorage.getItem(DAILY_LIMIT_KEY)
    return val ? Number(val) : 0
  } catch {
    return 0
  }
}

export default class GlobalSettingsModal extends Component<
  GlobalSettingsModalProps,
  GlobalSettingsModalState
> {
  static override contextType = I18nContext
  declare context: React.ContextType<typeof I18nContext>

  constructor(props: GlobalSettingsModalProps) {
    super(props)
    this.state = {
      theme: loadTheme(),
      dailyLimit: getGlobalDailyLimit(),
    }
  }

  private setTheme = (theme: 'system' | 'light' | 'dark') => {
    this.setState({ theme })
    applyTheme(theme)
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  }

  private setDailyLimit = (limit: number) => {
    this.setState({ dailyLimit: limit })
    try {
      localStorage.setItem(DAILY_LIMIT_KEY, String(limit))
    } catch {
      // ignore
    }
  }

  override render() {
    const { open, onClose } = this.props
    if (!open) return null

    const { theme, dailyLimit } = this.state
    const { locale, setLocale } = this.context
    const locales = getAvailableLocales()

    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

        {/* Modal */}
        <div className="fixed inset-x-3 top-12 z-50 bg-card border border-border rounded-xl shadow-2xl max-w-sm mx-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">{t('settings')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              ×
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Theme */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Tema
              </label>
              <div className="flex gap-1.5">
                {(
                  [
                    ['system', 'Auto'],
                    ['light', '☀ Claro'],
                    ['dark', '☾ Escuro'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => this.setTheme(key)}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                      theme === key
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            {/* Language */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                {t('language')}
              </label>
              <div className="flex gap-1.5">
                {locales.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => void setLocale(l.code)}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                      l.code === locale
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            {/* Global Daily Limit */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                {t('daily_limit')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={dailyLimit}
                  onChange={(e) => this.setDailyLimit(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 text-sm bg-muted border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">{t('no_limit')}</span>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }
}
