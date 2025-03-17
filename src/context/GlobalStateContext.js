import React, { createContext, useState, useEffect } from 'react';
import { GAME_STATUSES, GAME_TYPES } from '../constants';
import { DEFAULT_SETTINGS } from '../constants';

export const GlobalStateContext = createContext();

export const GlobalStateProvider = ({ children }) => {
  const [gameStatus, setGameStatus] = useState(GAME_STATUSES.WELCOME);
  const [gameType, setGameType] = useState(GAME_TYPES.STANDARD);
  const [totalScore, setTotalScore] = useState(0);

  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem('soundEnabled') !== null
      ? localStorage.getItem('soundEnabled') === 'true'
      : DEFAULT_SETTINGS.SOUND_ENABLED
  );
  const [userName, setUserName] = useState(
    localStorage.getItem('userName') || DEFAULT_SETTINGS.USER_NAME
  );
  const [avatar, setAvatar] = useState(
    localStorage.getItem('avatar') || DEFAULT_SETTINGS.AVATAR
  );
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || DEFAULT_SETTINGS.THEME
  );

  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('userName', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('avatar', avatar);
  }, [avatar]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  return (
    <GlobalStateContext.Provider
      value={{
        gameStatus,
        setGameStatus,
        gameType,
        setGameType,
        totalScore,
        setTotalScore,
        soundEnabled,
        setSoundEnabled,
        userName,
        setUserName,
        avatar,
        setAvatar,
        theme,
        setTheme,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};
