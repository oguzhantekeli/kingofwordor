import React from 'react';
import { HEADER } from '../../constants';
import './header.css';

const Header = ({ onSettingsClick }) => {
  return (
    <div className="navbar">
      <h1>{HEADER.APP_TITLE}</h1>
      <div className="header-actions">
        <button
          onClick={onSettingsClick}
          className="settings-button"
          title={HEADER.SETTINGS_ICON.TITLE}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="settings-icon"
            viewBox="0 0 24 24"
            width={HEADER.SETTINGS_ICON.WIDTH}
            height={HEADER.SETTINGS_ICON.HEIGHT}
            fill={HEADER.SETTINGS_ICON.COLOR}
          >
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.94-2.04l2.12 1.65a1 1 0 0 1 .28 1.32l-2 3.46a1 1 0 0 1-1.26.46l-2.5-1a7.99 7.99 0 0 1-1.8 1.04l-.38 2.65a1 1 0 0 1-1 .85h-4a1 1 0 0 1-1-.85l-.38-2.65a7.99 7.99 0 0 1-1.8-1.04l-2.5 1a1 1 0 0 1-1.26-.46l-2-3.46a1 1 0 0 1 .28-1.32l2.12-1.65a8.03 8.03 0 0 1 0-2.08L2.62 7.1a1 1 0 0 1-.28-1.32l2-3.46a1 1 0 0 1 1.26-.46l2.5 1a7.99 7.99 0 0 1 1.8-1.04l.38-2.65A1 1 0 0 1 10 0h4a1 1 0 0 1 1 .85l.38 2.65a7.99 7.99 0 0 1 1.8 1.04l2.5-1a1 1 0 0 1 1.26.46l2 3.46a1 1 0 0 1-.28 1.32l-2.12 1.65a8.03 8.03 0 0 1 0 2.08zM12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" />
          </svg>
        </button>
        <button type="button" className="donate-button">
          {HEADER.DONATE_TEXT}
        </button>
      </div>
    </div>
  );
};

export default Header;
