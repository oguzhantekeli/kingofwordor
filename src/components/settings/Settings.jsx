import React, { useContext, useState } from 'react';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import './settings.css';

/**
 * Validate URL to prevent XSS attacks
 * Only allows http:, https:, and data:image URLs
 */
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;

  const trimmedUrl = url.trim();
  if (trimmedUrl === '') return true; // Empty is valid (no avatar)

  try {
    const urlObj = new URL(trimmedUrl);
    // Only allow safe protocols
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return true;
    }
    // Allow data URLs only for images
    if (urlObj.protocol === 'data:' && trimmedUrl.startsWith('data:image/')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Sanitize user name - remove potentially dangerous characters
 */
const sanitizeUserName = (name) => {
  if (!name || typeof name !== 'string') return '';
  // Remove HTML tags and limit length
  return name.replace(/<[^>]*>/g, '').slice(0, 50);
};

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

  const [avatarError, setAvatarError] = useState('');

  const handleUserNameChange = (e) => {
    const sanitized = sanitizeUserName(e.target.value);
    setUserName(sanitized);
  };

  const handleAvatarChange = (e) => {
    const url = e.target.value;
    if (url === '' || isValidImageUrl(url)) {
      setAvatarError('');
      setAvatar(url);
    } else {
      setAvatarError(
        'Please enter a valid image URL (http, https, or data:image)'
      );
      setAvatar(url); // Still store for editing, but won't render unsafe URL
    }
  };

  const handleSave = () => {
    onSave();
  };

  // Only render avatar if it's a valid URL
  const safeAvatarUrl = isValidImageUrl(avatar) ? avatar : '';

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
            onChange={handleUserNameChange}
            placeholder="Enter your name"
            maxLength={50}
          />
        </label>
      </div>
      <div className="setting-item">
        <label>
          Avatar URL:
          <input
            type="url"
            value={avatar}
            onChange={handleAvatarChange}
            placeholder="Enter avatar image URL"
            className={avatarError ? 'input-error' : ''}
          />
        </label>
        {avatarError && <span className="error-message">{avatarError}</span>}
        {safeAvatarUrl && (
          <img
            src={safeAvatarUrl}
            alt="Avatar Preview"
            className="avatar-preview"
            onError={(e) => {
              e.target.style.display = 'none';
              setAvatarError('Failed to load image');
            }}
          />
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
