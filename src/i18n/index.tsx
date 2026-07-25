import React, { createContext, useContext, useState, useCallback } from 'react'
import zhCN from './zh-CN'
import enUS from './en-US'

export type Locale = 'zh-CN' | 'en-US'

const translations: Record<Locale, Record<string, Record<string, string>>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

interface I18nContextType {
  locale: Locale
  t: (key: string) => string
  toggleLocale: () => void
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh-CN')

  const t = useCallback(
    (key: string): string => {
      const parts = key.split('.')
      let obj: any = translations[locale]
      for (const part of parts) {
        obj = obj?.[part]
      }
      return obj ?? key
    },
    [locale]
  )

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === 'zh-CN' ? 'en-US' : 'zh-CN'))
  }, [])

  return (
    <I18nContext.Provider value={{ locale, t, toggleLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
