import React, { useState } from "react";
import "./board.css";
import BoardTop from "./BoardTop";
import GameSection from "./GameSection";
import InfoSection from "./InfoSection";

const Board = ({ changeStatus, gameType }) => {
  const [score, setScore] = useState(0);
  console.log("board score:", score);
  //score undefined????
  return (
    <>
      <div className="board">
        <BoardTop />
        <div className="playground">
          <GameSection gameType={gameType} setScore={setScore} score={score} />
          <InfoSection changeStatus={changeStatus} score={score} />
        </div>
      </div>
    </>
  );
};

export default Board;
