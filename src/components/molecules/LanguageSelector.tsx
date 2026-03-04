import { Component } from 'react'
import { I18nContext, getAvailableLocales } from '../../utils/i18n'

interface LanguageSelectorState {
  open: boolean
}

export default class LanguageSelector extends Component<
  Record<string, never>,
  LanguageSelectorState
> {
  static override contextType = I18nContext
  declare context: React.ContextType<typeof I18nContext>

  override state: LanguageSelectorState = { open: false }

  override render() {
    const { locale, setLocale } = this.context
    const locales = getAvailableLocales()
    const current = locales.find((l) => l.code === locale)

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            this.setState({ open: !this.state.open })
          }}
          className="px-2 py-1 text-[10px] rounded border border-input bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={current?.label}
        >
          {locale.split('-')[0]?.toUpperCase()}
        </button>
        {this.state.open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                this.setState({ open: false })
              }}
            />
            <div className="absolute right-0 top-full mt-1 z-50 border border-border bg-card rounded-lg shadow-lg py-1 min-w-[120px]">
              {locales.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    void setLocale(l.code)
                    this.setState({ open: false })
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${
                    l.code === locale ? 'font-medium text-primary' : 'text-foreground'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }
}
