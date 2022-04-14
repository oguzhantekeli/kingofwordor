import React from "react";

const InfoSection = ({ setGameStatus }) => {
  const onClick = () => {
    setGameStatus("endgame");
  };
  return (
    <>
      <div className="info-section">
        <div className="game-timer">
          <span>54</span>
          <br /> seconds left..
        </div>
        <div className="score">
          Score: <span>123</span>points
        </div>
        <button type="button" onClick={onClick}>
          endgame
        </button>
      </div>
    </>
  );
};

export default InfoSection;
