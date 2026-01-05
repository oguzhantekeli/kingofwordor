import React, { memo, useCallback } from 'react';
import './keyboard.css';

/**
 * Custom on-screen QWERTY keyboard for mobile
 * Prevents native keyboard from popping up
 */
const Keyboard = memo(
  ({ onKeyPress, onBackspace, onEnter, onClear, disabled }) => {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ];

    const handleKeyPress = useCallback(
      (key) => {
        if (!disabled) {
          onKeyPress(key);
        }
      },
      [onKeyPress, disabled]
    );

    const handleBackspace = useCallback(() => {
      if (!disabled) {
        onBackspace();
      }
    }, [onBackspace, disabled]);

    const handleEnter = useCallback(() => {
      if (!disabled) {
        onEnter();
      }
    }, [onEnter, disabled]);

    const handleClear = useCallback(() => {
      if (!disabled && onClear) {
        onClear();
      }
    }, [onClear, disabled]);

    return (
      <div className="keyboard" role="group" aria-label="On-screen keyboard">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboard-row">
            {rowIndex === 2 && (
              <div
                className="keyboard-key key-enter"
                onClick={handleEnter}
                role="button"
                tabIndex={-1}
              >
                ✓
              </div>
            )}
            {row.map((key) => (
              <div
                key={key}
                className="keyboard-key"
                onClick={() => handleKeyPress(key)}
                role="button"
                tabIndex={-1}
              >
                {key}
              </div>
            ))}
            {rowIndex === 2 && (
              <>
                <div
                  className="keyboard-key key-clear"
                  onClick={handleClear}
                  role="button"
                  tabIndex={-1}
                >
                  ✕
                </div>
                <div
                  className="keyboard-key key-backspace"
                  onClick={handleBackspace}
                  role="button"
                  tabIndex={-1}
                >
                  ⌫
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
);

Keyboard.displayName = 'Keyboard';

export default Keyboard;
