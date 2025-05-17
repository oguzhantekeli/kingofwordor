import React, { useEffect, useState, useContext } from 'react';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import { TIMERS, GAME_STATUSES } from '../../constants';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useSoundEffects } from '../../hooks/useSoundEffects';

/**
 * Game information section with timer, score and game controls
 *
 * @param {Object} props Component properties
 * @param {Function} props.setGameStatus Function to update game status
 * @param {Array} props.points Current points array
 * @param {number} props.multiplier Score multiplier
 * @param {Function} props.setTotalScore Function to update total score
 */
const InfoSection = ({ setGameStatus, points, multiplier, setTotalScore }) => {
  const { state } = useContext(GlobalStateContext);
  const { soundEnabled } = state;
  const timer = TIMERS.ONE_MINUTE;
  const [sum, setSum] = useState(0);
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

  // Calculate total score from points array
  const calculateTotalScore = () => {
    if (points.length > 0) {
      const scoreSum = points.reduce((a, b) => a + b, 0);
      setTotalScore(scoreSum);
      setSum(scoreSum);
    } else {
      setSum(0);
    }
  };

  // Recalculate score when points change
  useEffect(() => {
    calculateTotalScore();
  }, [points]);

  return (
    <div className="info-section">
      <div className="game-timer" aria-live="polite">
        <span>{isTimerEnded ? '' : `${countDown}..`}</span> seconds left
      </div>
      <div className="score">
        Score: <span>{sum.toFixed(2)}</span> points
      </div>
      <div className="score">
        Multiplier: x<span>{multiplier.toFixed(2)}</span>
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
