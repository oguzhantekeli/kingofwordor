import type { Lang } from '../../core/lang';

/**
 * The game keyboard per language: the layout each language's players already
 * type on, reduced to the letters the dictionary can contain. Accents have no
 * keys - they are folded (src/core/lang.ts) - but letters in their own right
 * do: Ñ in Spanish, Æ Ø Å in Danish, the Turkish letters on Turkish Q.
 *
 * Every layout holds exactly its alphabet, each letter once (layouts.test.ts):
 * a missing key would make words unplayable on the game keyboard, an extra
 * one would type a letter the dictionary never contains.
 */
export const LAYOUTS: Readonly<Record<Lang, readonly string[]>> = {
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  es: ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'],
  // AZERTY, as on French phones: m ends the middle row
  fr: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'],
  nl: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  'pt-BR': ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  da: ['qwertyuiopå', 'asdfghjklæø', 'zxcvbnm'],
  // Turkish Q without q, w and x, which the Turkish alphabet does not have
  tr: ['ertyuıopğü', 'asdfghjklşi', 'zcvbnmöç'],
};
