import React, { useState } from 'react';
import './board.css';
import BoardTop from './BoardTop';
import GameSection from './GameSection';
import InfoSection from './InfoSection';

const Board = ({ setGameStatus, gameType, setTotalScore }) => {
  const [points, setPoints] = useState([]);
  const [multiplier, setMultiplier] = useState(1);
  const [showGame, setShowGame] = useState(false);
  return (
    <>
      <div className="board">
        {!showGame && <BoardTop setShowGame={setShowGame} />}
        {showGame ? (
          <div className="playground">
            <div className="game-top-bar">
              <InfoSection
                setGameStatus={setGameStatus}
                points={points}
                multiplier={multiplier}
                setTotalScore={setTotalScore}
              />
              <div className="score-display">
                <div className="score-item">
                  <span className="score-label">Score</span>
                  <span className="score-value">
                    {points.length > 0
                      ? points.reduce((a, b) => a + b, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="score-item">
                  <span className="score-label">Multiplier</span>
                  <span className="score-value">x{multiplier.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <GameSection
              gameType={gameType}
              setPoints={setPoints}
              setMultiplier={setMultiplier}
              multiplier={multiplier}
              points={points}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Board;
