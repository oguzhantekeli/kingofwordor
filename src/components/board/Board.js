import React, { useState, useContext, useEffect, useRef } from 'react';
import './board-mobile.css';
import BoardTop from './BoardTop';
import GameSection from './GameSection';
import InfoSection from './InfoSection';
import { GlobalStateContext } from '../../context/GlobalStateContext';

const Board = () => {
  const { state, resetGameSession } = useContext(GlobalStateContext);
  const { pointsArray, multiplier } = state;
  const [showGame, setShowGame] = useState(false);
  const hasResetRef = useRef(false);
  const wakeLockRef = useRef(null);

  // Reset game session only once when Board first mounts (new game starts)
  useEffect(() => {
    if (!hasResetRef.current) {
      resetGameSession();
      hasResetRef.current = true;
    }
  }, [resetGameSession]);

  // Screen Wake Lock - prevent screen from turning off during gameplay
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && showGame) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('Wake Lock activated');

          // Re-acquire wake lock if page becomes visible again
          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        } catch (err) {
          console.log('Wake Lock error:', err.message);
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && showGame) {
        await requestWakeLock();
      }
    };

    if (showGame) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      // Release wake lock when game ends or component unmounts
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showGame]);

  return (
    <>
      <div className="board">
        {!showGame && <BoardTop setShowGame={setShowGame} />}
        {showGame ? (
          <div className="playground">
            <div className="game-top-bar">
              <InfoSection />
              <div className="score-display">
                <div className="score-item">
                  <span className="score-label">Score</span>
                  <span className="score-value">
                    {pointsArray.length > 0
                      ? pointsArray.reduce((a, b) => a + b, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="score-item">
                  <span className="score-label">Multiplier</span>
                  <span className="score-value">x{multiplier.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <GameSection />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Board;
