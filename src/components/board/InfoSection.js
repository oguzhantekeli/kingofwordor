import React, { useEffect, useState } from "react";

const InfoSection = ({ setGameStatus, points, multiplier, setTotalScore }) => {
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
          <span>54</span>
          <br /> seconds left..
        </div>
        <div className="score">
          Score: <span>{sum.toFixed(2)}</span> points
        </div>
        <div className="score">
          Multiplier: x<span>{multiplier.toFixed(2)}</span>
        </div>
        <button type="button" onClick={onClick}>
          endgame
        </button>
      </div>
    </>
  );
};

export default InfoSection;
