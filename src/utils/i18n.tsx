import { Component, createContext, type ReactNode } from 'react'
import ptBR from '../locales/pt-BR.json'

type Translations = Record<string, string>
type Locale = string

const STORAGE_KEY = 'wtf_locale'

// All locale JSONs - pt-BR is bundled, others loaded dynamically
const localeModules: Record<string, () => Promise<{ default: Translations }>> = {
  en: () => import('../locales/en.json'),
  es: () => import('../locales/es.json'),
}

const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'Português',
  en: 'English',
  es: 'Español',
}

// --- Singleton state ---

let currentLocale: Locale = 'pt-BR'
let currentTranslations: Translations = ptBR
let listeners: (() => void)[] = []

function notifyListeners() {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

async function loadLocale(locale: Locale): Promise<Translations> {
  if (locale === 'pt-BR') return ptBR
  const loader = localeModules[locale]
  if (!loader) return ptBR
  try {
    const mod = await loader()
    return mod.default
  } catch {
    return ptBR
  }
}

export async function setLocale(locale: Locale) {
  const translations = await loadLocale(locale)
  currentLocale = locale
  currentTranslations = translations
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: locale })
  } catch {
    // ignore - might not have chrome storage in tests
  }
  notifyListeners()
}

export function getLocale(): Locale {
  return currentLocale
}

export function getAvailableLocales(): { code: string; label: string }[] {
  return ['pt-BR', ...Object.keys(localeModules)].map((code) => ({
    code,
    label: LOCALE_LABELS[code] ?? code,
  }))
}

/**
 * Translate a key. Supports simple interpolation: t('key', { count: 5 })
 * Replaces {{variable}} patterns in the translated string.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const base = currentTranslations[key] ?? (ptBR as Translations)[key] ?? key
  if (!params) return base
  return base.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? `{{${k}}}`))
}

// --- React Context + Provider ---

interface I18nContextValue {
  locale: Locale
  t: typeof t
  setLocale: typeof setLocale
}

const I18nContext = createContext<I18nContextValue>({
  locale: currentLocale,
  t,
  setLocale,
})

interface I18nProviderState {
  locale: Locale
}

export class I18nProvider extends Component<{ children: ReactNode }, I18nProviderState> {
  private unsubscribe?: () => void

  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { locale: currentLocale }
  }

  override componentDidMount() {
    // Load saved locale preference
    try {
      chrome.storage.local.get([STORAGE_KEY], (data: Record<string, unknown>) => {
        const saved = data[STORAGE_KEY]
        if (typeof saved === 'string' && saved !== currentLocale) {
          void setLocale(saved)
        }
      })
    } catch {
      // detect browser language if chrome storage not available
      const browserLang = navigator.language
      if (browserLang && browserLang !== 'pt-BR' && localeModules[browserLang.split('-')[0]!]) {
        void setLocale(browserLang.split('-')[0]!)
      }
    }

    this.unsubscribe = subscribe(() => {
      this.setState({ locale: currentLocale })
    })
  }

  override componentWillUnmount() {
    this.unsubscribe?.()
  }

  override render() {
    return (
      <I18nContext.Provider
        value={{
          locale: this.state.locale,
          t,
          setLocale,
        }}
      >
        {this.props.children}
      </I18nContext.Provider>
    )
  }
}

export { I18nContext }
