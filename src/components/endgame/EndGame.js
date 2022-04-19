import React from "react";

import "./endgame.css";
const EndGame = ({ setGameStatus, totalScore }) => {
  const onClick = () => {
    setGameStatus("welcome");
  };
  const takeScreenShot = () => {
    console.log("screen shot ok");
  };
  return (
    <>
      <div className="endgame">
        <h2>Well Done.. Rest Now.</h2>
        <h3>Prepare for the next battle...</h3>
        <div className="showresult">
          <h3>Your total score is</h3>
          <span>{totalScore.toFixed(2)}</span>
        </div>
        <div className="takescreenshot">
          <p>Share your score with your friends</p>
          <div className="resultbuttons">
            <button type="button" onClick={takeScreenShot}>
              Share
            </button>
            <button className="endgame-restart" onClick={onClick}>
              Restart
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EndGame;
