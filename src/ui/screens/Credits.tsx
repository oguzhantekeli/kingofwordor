import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { PROFILES, type Lang } from '../../core/lang';
import './credits.css';

const SOURCE = 'github.com/LibreOffice/dictionaries, commit 32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4';

/**
 * The other languages' word lists: who made them, and the licence each is used
 * under (tools/dict-sources.mjs quotes each folder's own README). The game's
 * lists are generated from these files by tools/build-dict.mjs; the MPL asks
 * that players be told where the source is - SOURCE above.
 */
const WORD_LISTS: readonly { lang: Exclude<Lang, 'en'>; by: string; licence: string }[] = [
  { lang: 'es', by: 'Diccionario de español RLA-ES, Santiago Bosio and contributors', licence: 'MPL 1.1 (offered under GPL-3+ / LGPL-3+ / MPL-1.1+)' },
  { lang: 'fr', by: 'Dictionnaires orthographiques français 7.7, Olivier R. (Grammalecte) and contributors', licence: 'MPL 2.0' },
  { lang: 'nl', by: 'OpenTaal, https://opentaal.org', licence: 'Revised BSD License (offered under BSD-3-Clause and/or CC BY 3.0)' },
  { lang: 'pt-BR', by: 'VERO – Verificador Ortográfico Livre, Copyright (C) 2006-2013 Raimundo Santos Moura', licence: 'MPL (offered under LGPL-3 / MPL)' },
  { lang: 'da', by: 'Stavekontrolden, © 2020 Foreningen for frit tilgængelige sprogværktøjer, based on data from Det Danske Sprog- og Litteraturselskab', licence: 'MPL 1.1 (offered under GPL-2 / LGPL-2.1 / MPL-1.1)' },
  { lang: 'tr', by: 'hunspell-tr 1.1.1, Turkish Data Depository (Ali Safaya, Arda Göktoğan, Deniz Yuret, Emirhan Kurtuluş, Taner Sezer)', licence: 'MPL 2.0' },
];

/** OpenTaal's licence, reproduced as its BSD-3-Clause terms require for a binary. */
const OPENTAAL_BSD =
  'Copyright (c) 2020, OpenTaal. All rights reserved. Redistribution and use in source and binary forms, ' +
  'with or without modification, are permitted provided that the following conditions are met: ' +
  'Redistributions of source code must retain the above copyright notice, this list of conditions and the ' +
  'following disclaimer. Redistributions in binary form must reproduce the above copyright notice, this list ' +
  'of conditions and the following disclaimer in the documentation and/or other materials provided with the ' +
  'distribution. Neither the name of the copyright holder nor the names of its contributors may be used to ' +
  'endorse or promote products derived from this software without specific prior written permission. ' +
  'THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED ' +
  'WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A ' +
  'PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY ' +
  'DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, ' +
  'PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER ' +
  'CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE ' +
  'OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.';

/**
 * Licence obligations, verbatim. Every source permits commercial use and each
 * requires its notice to travel with the data - this screen is that notice.
 */
export function Credits() {
  const { t } = useTranslation();
  const goto = useGame((s) => s.goto);
  return (
    <div className="credits">
      <h2 className="credits-title">{t('credits.title')}</h2>

      <section>
        <h3>{t('credits.dictionary')} — SCOWL</h3>
        <p className="credits-notice">
          Copyright 2000-2011 by Kevin Atkinson. Permission to use, copy, modify,
          distribute and sell these word lists, the associated scripts, the output
          created from the scripts, and its documentation for any purpose is hereby
          granted without fee, provided that the above copyright notice appears in
          all copies and that both that copyright notice and this permission notice
          appear in supporting documentation. Kevin Atkinson makes no representations
          about the suitability of this array for any purpose. It is provided “as is”
          without express or implied warranty.
        </p>
      </section>

      <section>
        <h3>{t('credits.categories')} — WordNet 3.0</h3>
        <p className="credits-notice">
          WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
          Permission to use, copy, modify and distribute this software and database
          and its documentation for any purpose and without fee or royalty is hereby
          granted, provided that you agree to comply with the following copyright
          notice and statements, including the disclaimer, and that the same appear
          on ALL copies of the software, database and documentation. THIS SOFTWARE
          AND DATABASE IS PROVIDED “AS IS” AND PRINCETON UNIVERSITY MAKES NO
          REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED.
        </p>
      </section>

      <section>
        <h3>{t('credits.languages')}</h3>
        {WORD_LISTS.map(({ lang, by, licence }) => (
          <p key={lang} className="credits-notice">
            <b lang={PROFILES[lang].locale}>{PROFILES[lang].name}</b> — {by}. {licence}.
          </p>
        ))}
        <p className="credits-notice">Source: {SOURCE}.</p>
        <p className="credits-notice">{OPENTAAL_BSD}</p>
      </section>

      <section>
        <h3>{t('credits.frequency')} — Tatoeba</h3>
        <p className="credits-notice">
          How common each word is was counted in sentences from Tatoeba
          (https://tatoeba.org), released under CC BY 2.0 FR
          (https://creativecommons.org/licenses/by/2.0/fr/). Only word counts are
          used; no sentence is included.
        </p>
      </section>

      <section>
        <h3>{t('credits.art')}</h3>
        <p className="credits-notice">
          The knights, their heraldry and every animation frame are drawn by
          tools/knight.mjs; the sound effects and the theme are synthesised by
          tools/build-assets.mjs and tools/build-music.mjs. No asset pack, no
          stock library, nothing traced. Fonts: Silkscreen and Outfit, both
          under the SIL Open Font Licence; the Turkish letters Ğ Ş İ ı were added
          to Silkscreen as “Silkscreen TR”, under the same licence.
        </p>
      </section>

      <button type="button" className="btn btn--ghost" onClick={() => goto('welcome')}>
        {t('credits.back')}
      </button>
    </div>
  );
}
