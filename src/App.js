import React, { useState } from "react";
import Board from "./components/board/Board";
import Header from "./components/header/Header";
import Welcome from "./components/welcome/Welcome";
import EndGame from "./components/endgame/EndGame";
import "./mainstyles/main.css";

const App = () => {
  const [gameStatus, setGameStatus] = useState("welcome");
  const [gameType, setGameType] = useState("standard");
  const [totalScore, setTotalScore] = useState(0);

  const screenChange = (status) => {
    switch (status) {
      case "welcome":
        return (
          <Welcome setGameStatus={setGameStatus} setGameType={setGameType} />
        );
      case "ingame":
        return (
          <Board
            setGameStatus={setGameStatus}
            gameType={gameType}
            setTotalScore={setTotalScore}
          />
        );
      case "endgame":
        return (
          <EndGame totalScore={totalScore} setGameStatus={setGameStatus} />
        );
      default:
        return <div>An Error Occured please refresh page.</div>;
    }
  };
  return (
    <>
      <div className="app">
        <Header />
        {screenChange(gameStatus)}
      </div>
    </>
  );
};

export default App;
