import React from "react";
import "./endgame.css";
const EndGame = ({ setGameStatus }) => {
  const onClick = () => {
    setGameStatus("welcome");
  };
  return (
    <>
      <div className="endgame">endgame</div>
      <button className="endgame-restart" onClick={onClick}>
        restart
      </button>
    </>
  );
};

export default EndGame;
