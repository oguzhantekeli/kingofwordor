import React, { createContext, useReducer, useEffect } from 'react';
import { GAME_STATUSES, GAME_TYPES } from '../constants';
import { DEFAULT_SETTINGS } from '../constants';

export const GlobalStateContext = createContext();

/**
 * Reducer function to handle all state updates in one place
 */
const globalReducer = (state, action) => {
  switch (action.type) {
    case 'SET_GAME_STATUS':
      return { ...state, gameStatus: action.payload };
    case 'SET_GAME_TYPE':
      return { ...state, gameType: action.payload };
    case 'SET_TOTAL_SCORE':
      return { ...state, totalScore: action.payload };
    case 'UPDATE_SCORE':
      return {
        ...state,
        points: action.payload.points,
        lastWordScore: action.payload.lastWordScore,
        lastWord: action.payload.lastWord,
      };
    case 'SET_SOUND_ENABLED':
      localStorage.setItem('soundEnabled', action.payload);
      return { ...state, soundEnabled: action.payload };
    case 'SET_USER_NAME':
      localStorage.setItem('userName', action.payload);
      return { ...state, userName: action.payload };
    case 'SET_AVATAR':
      localStorage.setItem('avatar', action.payload);
      return { ...state, avatar: action.payload };
    case 'SET_THEME':
      localStorage.setItem('theme', action.payload);
      return { ...state, theme: action.payload };
    case 'SET_RULES_DATA':
      return { ...state, rulesData: action.payload };
    case 'SET_MULTIPLIER':
      return { ...state, multiplier: action.payload };
    default:
      return state;
  }
};

export const GlobalStateProvider = ({ children }) => {
  // Initialize state with values from localStorage where applicable
  const initialState = {
    gameStatus: GAME_STATUSES.WELCOME,
    gameType: GAME_TYPES.STANDARD,
    totalScore: 0,
    points: 0,
    lastWordScore: 0,
    lastWord: '',
    multiplier: 1,
    rulesData: {},
    soundEnabled:
      localStorage.getItem('soundEnabled') !== null
        ? localStorage.getItem('soundEnabled') === 'true'
        : DEFAULT_SETTINGS.SOUND_ENABLED,
    userName: localStorage.getItem('userName') || DEFAULT_SETTINGS.USER_NAME,
    avatar: localStorage.getItem('avatar') || DEFAULT_SETTINGS.AVATAR,
    theme: localStorage.getItem('theme') || DEFAULT_SETTINGS.THEME,
  };

  const [state, dispatch] = useReducer(globalReducer, initialState);

  // Apply theme class to body element when theme changes
  useEffect(() => {
    document.body.className =
      state.theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [state.theme]);

  // Compatibility layer for components still using the old API
  const compatibilityAPI = {
    // Getters
    gameStatus: state.gameStatus,
    gameType: state.gameType,
    totalScore: state.totalScore,
    soundEnabled: state.soundEnabled,
    userName: state.userName,
    avatar: state.avatar,
    theme: state.theme,

    // Setter functions
    setGameStatus: (status) =>
      dispatch({ type: 'SET_GAME_STATUS', payload: status }),
    setGameType: (type) => dispatch({ type: 'SET_GAME_TYPE', payload: type }),
    setTotalScore: (score) =>
      dispatch({ type: 'SET_TOTAL_SCORE', payload: score }),
    setSoundEnabled: (enabled) =>
      dispatch({ type: 'SET_SOUND_ENABLED', payload: enabled }),
    setUserName: (name) => dispatch({ type: 'SET_USER_NAME', payload: name }),
    setAvatar: (avatar) => dispatch({ type: 'SET_AVATAR', payload: avatar }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
  };

  return (
    <GlobalStateContext.Provider
      value={{
        ...compatibilityAPI,
        state,
        dispatch,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};
