/**
 * Vira City — Internationalization (i18n) Type Definitions
 */

export type LocaleKey = 'en' | 'es' | 'de' | 'fr' | 'zh' | 'ja';

export interface LocaleInfo {
  code: LocaleKey;
  name: string;
  nativeName: string;
  flag: string;
}

export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary;
};
