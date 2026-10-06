import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSession } from '../../store/sessionStore';
import {
  NotConfiguredError, deleteAccount, isConfigured, signInWithGoogle, signOutEverywhere,
} from '../../platform/supabase';
import { Knight } from '../components/Knight';
import { HOUSES } from '../sprites.generated';
import './profile.css';

/**
 * Identity, and the account controls Google Play requires.
 *
 * A guest sees what signing in would add, stated plainly and without a dark
 * pattern on the decline. A signed-in player can sign out and can delete the
 * account from here - Play's User Data policy requires that path to exist
 * in-app, alongside a web page that does the same without reinstalling.
 */
export function Profile() {
  const { t } = useTranslation();
  const goto = useGame((s) => s.goto);
  const { status, name, house, localBest, setName, setHouse, signedIn, signedOut, forget } =
    useSession();

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guest = status === 'guest';

  /**
   * Delete must do what the dialog promises. It used to call only forget(),
   * which wiped this phone and left the server account and every score intact.
   * If the server delete fails, local data is KEPT so the player can retry -
   * otherwise they would lose their progress and keep their server data.
   */
  const destroy = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!guest && isConfigured()) await deleteAccount();
      forget();
      setConfirming(false);
      goto('welcome');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try { await signOutEverywhere(); } catch { /* local sign-out still proceeds */ }
    signedOut();
  };

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      signedIn(await signInWithGoogle());
    } catch (e) {
      setError(e instanceof NotConfiguredError ? t('profile.notConfigured') : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile">
      <header className="sheet-bar">
        <button type="button" className="icon-btn" onClick={() => goto('welcome')}
                aria-label={t('nav.back')}>
          <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
            <rect x="5" y="2" width="2" height="2" fill="currentColor" />
            <rect x="3" y="4" width="2" height="2" fill="currentColor" />
            <rect x="1" y="6" width="2" height="2" fill="currentColor" />
            <rect x="3" y="8" width="2" height="2" fill="currentColor" />
            <rect x="5" y="10" width="2" height="2" fill="currentColor" />
          </svg>
        </button>
        <h2>{t('profile.title')}</h2>
      </header>

      <section className="panel id-card">
        <Knight house={house} anim="idle" scale={2} />
        <div className="id-fields">
          <label className="field">
            <span className="field-label">{t('profile.name')}</span>
            <input className="field-input" value={name} maxLength={16}
                   onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="id-status">{guest ? t('profile.guest') : t('profile.signedIn')}</p>
        </div>
      </section>

      <section className="houses">
        <h3 className="section-head">{t('profile.house')}</h3>
        <div className="house-row" role="radiogroup" aria-label={t('profile.house')}>
          {HOUSES.map((h) => (
            <label key={h} className={`house${house === h ? ' is-selected' : ''}`}>
              <input type="radio" name="house" value={h} className="visually-hidden"
                     checked={house === h} onChange={() => setHouse(h)} />
              <Knight house={h} anim="idle" scale={1} label={h} />
            </label>
          ))}
        </div>
      </section>

      <section className="panel stat">
        <span className="stat-label">{t('profile.bestRun')}</span>
        <span className="stat-value">{localBest > 0 ? localBest.toFixed(1) : '—'}</span>
      </section>

      {guest ? (
        <section className="benefits">
          <h3 className="section-head">{t('guest.title')}</h3>
          <p className="benefits-body">{t('guest.body')}</p>
          <ul className="benefits-list">
            <li>{t('guest.benefitLadder')}</li>
            <li>{t('guest.benefitCarry')}</li>
            <li>{t('guest.benefitDuel')}</li>
          </ul>
          <button type="button" className="btn btn--primary wide" onClick={() => void signIn()}
                  disabled={busy}>
            {t('guest.cta')}
          </button>
          <p className="benefits-foot">{t('guest.noForce')}</p>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      ) : (
        <section className="account">
          <button type="button" className="btn wide" onClick={() => void signOut()}>
            {t('profile.signOut')}
          </button>
          <button type="button" className="btn btn--danger wide" onClick={() => setConfirming(true)}>
            {t('profile.deleteAccount')}
          </button>
        </section>
      )}

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true"
             aria-label={t('profile.deleteAccount')}>
          <div className="panel modal-card">
            <p className="modal-text">{t('profile.deleteBody')}</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn--danger" disabled={busy}
                      onClick={() => void destroy()}>
                {t('profile.deleteConfirm')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                {t('confirm.no')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
