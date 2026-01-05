import React, { useState, useEffect, useContext } from 'react';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import { TIMERS, GAME_STATUSES } from '../../constants';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useSoundEffects } from '../../hooks/useSoundEffects';

/**
 * Timer section with game timer and end game button
 * Now uses GlobalStateContext instead of props
 */
const InfoSection = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const { state, setGameStatus, setTotalScore } =
    useContext(GlobalStateContext);
  const { soundEnabled, pointsArray } = state;
  const timer = TIMERS.FIVE_MINUTE;
  const sounds = useSoundEffects(soundEnabled);

  // Handle game end when timer ends
  const handleTimeEnd = () => {
    sounds.playCorrectSound(); // Play victory sound
    setGameStatus(GAME_STATUSES.ENDGAME);
  };

  // Use our custom timer hook
  const { countDown, isTimerEnded } = useGameTimer(timer, handleTimeEnd);

  // Handler for manual game end with confirmation
  const handleEndGame = () => {
    setShowConfirm(true);
  };

  const confirmGiveUp = () => {
    setShowConfirm(false);
    setGameStatus(GAME_STATUSES.ENDGAME);
  };

  const cancelGiveUp = () => {
    setShowConfirm(false);
  };

  // Calculate total score when timer ends or game ends
  useEffect(() => {
    if (pointsArray.length > 0) {
      const scoreSum = pointsArray.reduce((a, b) => a + b, 0);
      setTotalScore(scoreSum);
    }
  }, [pointsArray, setTotalScore]);

  // Format seconds to MM:SS only for 60+ seconds
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return seconds.toString();
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine timer warning state
  const getTimerClass = () => {
    if (isTimerEnded) return 'timer-value ended';
    if (countDown <= 10) return 'timer-value critical';
    if (countDown <= 30) return 'timer-value warning';
    return 'timer-value';
  };

  return (
    <>
      {showConfirm && (
        <div className="confirm-overlay" onClick={cancelGiveUp}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">💀</div>
            <p className="confirm-text">Are you sure you want to give up?</p>
            <div className="confirm-buttons">
              <div
                className="confirm-btn confirm-yes"
                onClick={confirmGiveUp}
                role="button"
                tabIndex={-1}
              >
                Yes, Give Up
              </div>
              <div
                className="confirm-btn confirm-no"
                onClick={cancelGiveUp}
                role="button"
                tabIndex={-1}
              >
                Keep Fighting
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="timer-controls">
        <div
          className={`game-timer ${countDown <= 30 ? 'timer-urgent' : ''}`}
          aria-live="polite"
          aria-label={`Time remaining: ${formatTime(countDown)}`}
        >
          <div className="timer-icon">⏱️</div>
          <span className={getTimerClass()}>
            {isTimerEnded ? '00:00' : formatTime(countDown)}
          </span>
        </div>
        <div
          onClick={handleEndGame}
          className="end-game-button"
          role="button"
          tabIndex={-1}
          aria-label="Give up"
        >
          <span className="give-up-icon">💀</span>
          Give Up
        </div>
      </div>
    </>
  );
};

export default InfoSection;
