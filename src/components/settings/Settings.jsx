import React, { useContext } from 'react';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import './settings.css';

const Settings = ({ onSave }) => {
  const {
    soundEnabled,
    setSoundEnabled,
    userName,
    setUserName,
    avatar,
    setAvatar,
    theme,
    setTheme,
  } = useContext(GlobalStateContext);

  const handleSave = () => {
    onSave();
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
          />
          Sound {soundEnabled ? 'On' : 'Off'}
        </label>
      </div>
      <div className="setting-item">
        <label>
          Name:
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
          />
        </label>
      </div>
      <div className="setting-item">
        <label>
          Avatar URL:
          <input
            type="text"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="Enter avatar image URL"
          />
        </label>
        {avatar && (
          <img src={avatar} alt="Avatar Preview" className="avatar-preview" />
        )}
      </div>
      <div className="setting-item">
        <label>
          Theme:
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <button onClick={handleSave} className="save-button">
        Save Settings
      </button>
    </div>
  );
};

export default Settings;
