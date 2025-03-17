import { createContext, useContext, useState } from 'react';

const initialState = {
  gameStatus: '',
  changeStatus: () => {},
  gameType: '',
  changeType: () => {},
  score: 0,
  changeScore: () => {},
};
export const gameContext = createContext(initialState);

export const GameContextProvider = ({ children }) => {
  const [gameStatus, setGameStatus] = useState('welcome');
  const [gameType, setGameType] = useState('standart');
  const [score, setScore] = useState(0);
  function changeStatus(status) {
    setGameStatus(status);
    console.log('changestatus:', gameStatus);
  }
  function changeType(type) {
    setGameType(type);
    console.log('changetype', gameType);
  }
  function changeScore(points) {
    setScore(points);
    console.log('changescore', score);
  }
  return (
    <gameContext.Provider
      value={{
        gameStatus,
        gameType,
        score,
        changeScore,
        changeStatus,
        changeType,
      }}
    >
      {children}
    </gameContext.Provider>
  );
};

export const useGameContext = () => {
  const { gameStatus, gameType, score, changeScore, changeStatus, changeType } =
    useContext(gameContext);
  return { gameStatus, gameType, score, changeScore, changeStatus, changeType };
};
