import React, { useEffect } from 'react';
import Settings from './Settings';
import './settingsModal.css';

const SettingsModal = ({ isOpen, onClose, onSave }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-close"
          onClick={onClose}
          role="button"
          tabIndex={-1}
          aria-label="Close settings"
        >
          ✕
        </div>
        <Settings onSave={onSave} />
      </div>
    </div>
  );
};

export default SettingsModal;
