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
        <BoardTop setShowGame={setShowGame} />
        {showGame ? (
          <div className="playground">
            <GameSection
              gameType={gameType}
              setPoints={setPoints}
              setMultiplier={setMultiplier}
              multiplier={multiplier}
              points={points}
            />
            <InfoSection
              setGameStatus={setGameStatus}
              points={points}
              multiplier={multiplier}
              setTotalScore={setTotalScore}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Board;
