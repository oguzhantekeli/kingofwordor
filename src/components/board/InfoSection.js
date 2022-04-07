import React from "react";

const InfoSection = ({ changeStatus }) => {
  const onClick = () => {
    changeStatus("endgame");
  };
  return (
    <>
      <div className="info-section">
        <div className="game-timer">
          <span>54</span>seconds left..
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
