import React, { useState } from "react";
import Board from "./components/board/Board";
import Header from "./components/header/Header";
import Welcome from "./components/welcome/Welcome";
import EndGame from "./components/endgame/EndGame";
// import "./mainstyles/reset.css";
import "./mainstyles/main.css";

const App = () => {
  const [screenSwap, setScreenSwap] = useState("welcome");
  const [gameType, setGameType] = useState("standart");
  return (
    <>
      <div className="app">
        <Header />
        {screenSwap === "welcome" ? (
          <Welcome changeStatus={setScreenSwap} setGameType={setGameType} />
        ) : null}
        {screenSwap === "ingame" ? (
          <Board changeStatus={setScreenSwap} gameType={gameType} />
        ) : null}
        {screenSwap === "endgame" ? (
          <EndGame changeStatus={setScreenSwap} />
        ) : null}
      </div>
    </>
  );
};

export default App;
