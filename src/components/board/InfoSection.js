import React, { useEffect, useState, useContext } from 'react';
import useSound from 'use-sound';
import hurraySound from '../../assets/hurray.wav';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import { TIMERS, GAME_STATUSES } from '../../constants';

const InfoSection = ({ setGameStatus, points, multiplier, setTotalScore }) => {
  const { soundEnabled } = useContext(GlobalStateContext);
  const timer = TIMERS.ONE_MINUTE;
  const [countDown, setCountDown] = useState(timer);
  const [isTimerEnded, setIsTimerEnded] = useState(false);
  const [playHurraySound] = useSound(hurraySound, { volume: 0.25 });

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCountDown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(intervalId);
          if (soundEnabled) playHurraySound();
          setIsTimerEnded(true);
          setGameStatus(GAME_STATUSES.ENDGAME);
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [setGameStatus, playHurraySound, soundEnabled]);

  const [sum, setSum] = useState(0);
  const onClick = () => setGameStatus(GAME_STATUSES.ENDGAME);

  const summer = (a, b) => a + b;
  const getScore = () => {
    if (points.length > 0) {
      const scoreSum = points.reduce(summer);
      setTotalScore(scoreSum);
      setSum(scoreSum);
    } else {
      setSum(0);
    }
  };

  useEffect(() => {
    getScore();
  }, [points]);

  return (
    <div className="info-section">
      <div className="game-timer">
        <span>{isTimerEnded ? '' : `${countDown}..`}</span> seconds left..
      </div>
      <div className="score">
        Score: <span>{sum.toFixed(2)}</span> points
      </div>
      <div className="score">
        Multiplier: x<span>{multiplier.toFixed(2)}</span>
      </div>
      <button type="button" onClick={onClick}>
        End Game :(
      </button>
    </div>
  );
};

export default InfoSection;
