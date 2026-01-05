import React, {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
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
    // Game session actions
    case 'SET_ANSWERS':
      return { ...state, answers: action.payload };
    case 'ADD_ANSWER':
      return { ...state, answers: [...state.answers, action.payload] };
    case 'SET_POINTS':
      return { ...state, pointsArray: action.payload };
    case 'ADD_POINTS':
      return { ...state, pointsArray: [...state.pointsArray, action.payload] };
    case 'RESET_GAME_SESSION':
      return {
        ...state,
        answers: [],
        pointsArray: [],
        multiplier: 1,
        rulesData: {},
        totalScore: 0,
        // Preserve gameStatus and gameType - they should not be reset
      };
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
    // Game session state (previously prop-drilled)
    answers: [],
    pointsArray: [],
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

  // Memoized setter functions to prevent infinite loops in useEffect deps
  const setGameStatus = useCallback(
    (status) => dispatch({ type: 'SET_GAME_STATUS', payload: status }),
    []
  );
  const setGameType = useCallback(
    (type) => dispatch({ type: 'SET_GAME_TYPE', payload: type }),
    []
  );
  const setTotalScore = useCallback(
    (score) => dispatch({ type: 'SET_TOTAL_SCORE', payload: score }),
    []
  );
  const setSoundEnabled = useCallback(
    (enabled) => dispatch({ type: 'SET_SOUND_ENABLED', payload: enabled }),
    []
  );
  const setUserName = useCallback(
    (name) => dispatch({ type: 'SET_USER_NAME', payload: name }),
    []
  );
  const setAvatar = useCallback(
    (avatar) => dispatch({ type: 'SET_AVATAR', payload: avatar }),
    []
  );
  const setTheme = useCallback(
    (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
    []
  );
  const setAnswers = useCallback(
    (answers) => dispatch({ type: 'SET_ANSWERS', payload: answers }),
    []
  );
  const addAnswer = useCallback(
    (answer) => dispatch({ type: 'ADD_ANSWER', payload: answer }),
    []
  );
  const setPointsArray = useCallback(
    (points) => dispatch({ type: 'SET_POINTS', payload: points }),
    []
  );
  const addPoints = useCallback(
    (points) => dispatch({ type: 'ADD_POINTS', payload: points }),
    []
  );
  const setMultiplier = useCallback(
    (multiplier) => dispatch({ type: 'SET_MULTIPLIER', payload: multiplier }),
    []
  );
  const setRulesData = useCallback(
    (rules) => dispatch({ type: 'SET_RULES_DATA', payload: rules }),
    []
  );
  const resetGameSession = useCallback(
    () => dispatch({ type: 'RESET_GAME_SESSION' }),
    []
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      // Getters (derived from state)
      gameStatus: state.gameStatus,
      gameType: state.gameType,
      totalScore: state.totalScore,
      soundEnabled: state.soundEnabled,
      userName: state.userName,
      avatar: state.avatar,
      theme: state.theme,
      // Memoized setters
      setGameStatus,
      setGameType,
      setTotalScore,
      setSoundEnabled,
      setUserName,
      setAvatar,
      setTheme,
      setAnswers,
      addAnswer,
      setPointsArray,
      addPoints,
      setMultiplier,
      setRulesData,
      resetGameSession,
      // Full state and dispatch for advanced use
      state,
      dispatch,
    }),
    [
      state,
      setGameStatus,
      setGameType,
      setTotalScore,
      setSoundEnabled,
      setUserName,
      setAvatar,
      setTheme,
      setAnswers,
      addAnswer,
      setPointsArray,
      addPoints,
      setMultiplier,
      setRulesData,
      resetGameSession,
    ]
  );

  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
};
