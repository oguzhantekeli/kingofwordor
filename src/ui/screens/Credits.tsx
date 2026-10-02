import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import './credits.css';

/**
 * Licence obligations, verbatim. Both sources permit commercial use and both
 * require the notice to travel with the data - this screen is that notice.
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

      <button type="button" className="btn btn--ghost" onClick={() => goto('welcome')}>
        {t('credits.back')}
      </button>
    </div>
  );
}
