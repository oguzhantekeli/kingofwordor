import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES, PROFILES, type Lang } from '../core/lang';
import { useSettings } from '../store/settingsStore';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import nl from './nl.json';
import ptBR from './pt-BR.json';
import da from './da.json';
import tr from './tr.json';

/**
 * Every bundle is bundled: seven files of ~7 KB each are cheaper than a
 * network round trip on a language switch, and the game works offline.
 */
type Bundle = Readonly<Record<string, Readonly<Record<string, string>>>>;
export const RESOURCES: Readonly<Record<Lang, { translation: Bundle }>> = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  nl: { translation: nl },
  'pt-BR': { translation: ptBR },
  da: { translation: da },
  tr: { translation: tr },
};

export const SUPPORTED_LANGUAGES = LANGUAGES;

/** The UI language follows the game language; html lang drives CSS casing (Turkish İ). */
export function applyLanguage(lang: Lang): void {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  if (typeof document !== 'undefined') document.documentElement.lang = PROFILES[lang].locale;
}

if (!i18n.isInitialized) {
  // the settings store hydrates synchronously from localStorage, so the very
  // first render is already in the player's language - no English flash
  const lng = useSettings.getState().language;
  i18n.use(initReactI18next).init({
    resources: RESOURCES,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  if (typeof document !== 'undefined') document.documentElement.lang = PROFILES[lng].locale;
}

export default i18n;
