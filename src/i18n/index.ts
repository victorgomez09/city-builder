/**
 * Vira City — Internationalization (i18n) Engine (`src/i18n/index.ts`)
 *
 * Lightweight, zero-dependency, reactive localization engine supporting
 * nested key translation with fallback, variable interpolation, and regional formatting.
 */

import { LocaleKey, LocaleInfo } from './types';
import { en } from './locales/en';
import { es } from './locales/es';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { zh } from './locales/zh';
import { ja } from './locales/ja';

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
];

const DICTIONARIES: Record<LocaleKey, any> = { en, es, de, fr, zh, ja };
const STORAGE_KEY = 'viracity_locale';

const LOCALE_TAGS: Record<LocaleKey, string> = {
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

const MONTH_NAMES: Record<LocaleKey, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

function detectDefaultLocale(): LocaleKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LocaleKey | null;
    if (saved && saved in DICTIONARIES) return saved;

    const navLang = navigator.language?.toLowerCase() || '';
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('de')) return 'de';
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('ja')) return 'ja';
  } catch {
    // Ignore storage/navigator access errors
  }
  return 'en';
}

let activeLocale: LocaleKey = detectDefaultLocale();
const subscribers = new Set<(loc: LocaleKey) => void>();

function resolveNestedKey(obj: any, path: string): string | undefined {
  if (!obj) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export const I18n = {
  getLocale(): LocaleKey {
    return activeLocale;
  },

  getLocaleTag(): string {
    return LOCALE_TAGS[activeLocale] || 'en-US';
  },

  setLocale(locale: LocaleKey): void {
    if (!(locale in DICTIONARIES)) return;
    activeLocale = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    } catch {
      // Ignore
    }
    subscribers.forEach(cb => {
      try {
        cb(locale);
      } catch (err) {
        console.error('Error in i18n subscriber:', err);
      }
    });
  },

  onLocaleChange(callback: (loc: LocaleKey) => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  t(key: string, paramsOrFallback?: Record<string, string | number> | string, fallbackStr?: string): string {
    const params = typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : undefined;
    const fallback = typeof paramsOrFallback === 'string' ? paramsOrFallback : fallbackStr;

    let str = resolveNestedKey(DICTIONARIES[activeLocale], key);
    if (str === undefined) {
      str = resolveNestedKey(DICTIONARIES.en, key);
    }
    if (str === undefined) {
      return fallback !== undefined ? fallback : key;
    }

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  },

  formatMoney(amount: number): string {
    const isNegative = amount < 0;
    const absVal = Math.round(Math.abs(amount));
    const tag = LOCALE_TAGS[activeLocale] || 'en-US';
    const formatted = absVal.toLocaleString(tag);
    return (isNegative ? '-$' : '$') + formatted;
  },

  formatNumber(n: number): string {
    const tag = LOCALE_TAGS[activeLocale] || 'en-US';
    return Math.round(n).toLocaleString(tag);
  },

  formatDate(month: number, year: number): string {
    const names = MONTH_NAMES[activeLocale] || MONTH_NAMES.en;
    const m = names[Math.max(0, Math.min(11, month))] || `M${month + 1}`;
    const yrLabel = activeLocale === 'es' ? 'Año' : activeLocale === 'de' ? 'Jahr' : activeLocale === 'fr' ? 'An' : activeLocale === 'zh' ? '第' : activeLocale === 'ja' ? '年目' : 'Year';

    if (activeLocale === 'zh') {
      return `第${year}年 ${m}`;
    }
    if (activeLocale === 'ja') {
      return `${year}年目 ${m}`;
    }
    return `${m} ${yrLabel} ${year}`;
  },
};

export const t = I18n.t;
