import React, { useEffect, useState } from "react";
import useSound from "use-sound";
import hurraySound from "../../assets/hurray.wav";

const InfoSection = ({ setGameStatus, points, multiplier, setTotalScore }) => {
  const timer = 60;
  const [countDown, setCountDown] = useState(timer);
  const [isTimerEnded, setIsTimerEnded] = useState(false);
  const [playHurraySound] = useSound(hurraySound, { volume: 0.25 });

  useEffect(() => {
    let intervale = setInterval(() => {
      if (countDown !== 0) {
        setCountDown(countDown - 1);
      } else {
        clearInterval(intervale);
        playHurraySound();
        setIsTimerEnded(true);
        setGameStatus("endgame");
      }
    }, 1000);
    return () => {
      clearInterval(intervale);
    };
  }, [countDown]);

  const [sum, setSum] = useState(0);
  const onClick = () => {
    setGameStatus("endgame");
  };
  const summer = (a, b) => {
    return a + b;
  };
  const getScore = () => {
    if (points.length > 0) {
      let sum = points.reduce(summer);
      setTotalScore(sum);
      setSum(sum);
    } else {
      setSum(0);
    }
  };
  useEffect(() => {
    getScore();
  }, [points]);

  return (
    <>
      <div className="info-section">
        <div className="game-timer">
          <span>{isTimerEnded ? "" : `${countDown}..`}</span> seconds left..
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
    </>
  );
};

export default InfoSection;
