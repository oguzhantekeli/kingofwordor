import React from 'react';

import './endgame.css';
const EndGame = ({ setGameStatus, totalScore }) => {
  const onClick = () => {
    setGameStatus('welcome');
  };
  const takeScreenShot = () => {
    console.log('screen shot ok');
  };
  return (
    <>
      <div className="endgame">
        <h2>Well Done, Champion!</h2>
        <h3>The next challenge awaits...</h3>
        <div className="showresult">
          <h3>Score</h3>
          <span className="score-value">{totalScore.toFixed(2)}</span>
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
