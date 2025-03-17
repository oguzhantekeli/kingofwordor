import React from 'react';
import Settings from './Settings';
import './settingsModal.css';

const SettingsModal = ({ isOpen, onClose, onSave }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <Settings onSave={onSave} />
      </div>
    </div>
  );
};

export default SettingsModal;
