import React, { useEffect, useContext } from 'react';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import { TIMERS, GAME_STATUSES } from '../../constants';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useSoundEffects } from '../../hooks/useSoundEffects';

/**
 * Timer section with game timer and end game button
 *
 * @param {Object} props Component properties
 * @param {Function} props.setGameStatus Function to update game status
 * @param {Array} props.points Current points array
 * @param {Function} props.setTotalScore Function to update total score
 */
const InfoSection = ({ setGameStatus, points, setTotalScore }) => {
  const { state } = useContext(GlobalStateContext);
  const { soundEnabled } = state;
  const timer = TIMERS.FIVE_MINUTE;
  const sounds = useSoundEffects(soundEnabled);

  // Handle game end when timer ends
  const handleTimeEnd = () => {
    sounds.playCorrectSound(); // Play victory sound
    setGameStatus(GAME_STATUSES.ENDGAME);
  };

  // Use our custom timer hook
  const { countDown, isTimerEnded } = useGameTimer(timer, handleTimeEnd);

  // Handler for manual game end
  const handleEndGame = () => {
    setGameStatus(GAME_STATUSES.ENDGAME);
  };

  // Calculate total score when timer ends or game ends
  useEffect(() => {
    if (points.length > 0) {
      const scoreSum = points.reduce((a, b) => a + b, 0);
      setTotalScore(scoreSum);
    }
  }, [points, setTotalScore]);

  // Format seconds to MM:SS only for 60+ seconds
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return seconds.toString();
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer-controls">
      <div className="game-timer" aria-live="polite">
        <div className="timer-icon">⏱️</div>
        <span className="timer-value">
          {isTimerEnded ? '00:00' : formatTime(countDown)}
        </span>
      </div>
      <button
        type="button"
        onClick={handleEndGame}
        className="end-game-button"
        aria-label="End game early"
      >
        End Game
      </button>
    </div>
  );
};

export default InfoSection;
