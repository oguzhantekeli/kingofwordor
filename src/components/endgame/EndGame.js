import React from "react";
import "./endgame.css";
const EndGame = ({ changeStatus }) => {
  const onClick = () => {
    changeStatus("welcome");
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
