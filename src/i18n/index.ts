import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/**
 * Wired from day one. Adding a language is a resource bundle plus a dictionary
 * artifact - never an API call (brief requirement #4).
 *
 * Imported by App.tsx, not only by main.tsx. This import is load-bearing:
 * without it, anything that renders <App/> without going through main.tsx gets
 * an uninitialised i18next and react-i18next renders raw keys - literally
 * "welcome.start" instead of "Enter the Battle". Caught by the gameplay
 * integration test. The isInitialized guard makes repeated imports and hot
 * reloads safe.
 */
export const SUPPORTED_LANGUAGES = ['en'] as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export default i18n;
