import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for handling game timer functionality
 *
 * @param {number} initialTime - Starting time in seconds
 * @param {function} onTimeEnd - Callback to run when timer reaches zero
 * @returns {Object} Timer state and control functions
 */
export const useGameTimer = (initialTime, onTimeEnd) => {
  const [countDown, setCountDown] = useState(initialTime);
  const [isTimerEnded, setIsTimerEnded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Clear any existing timer on component mount/unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (countDown > 0 && !isPaused) {
      timerRef.current = setTimeout(() => {
        setCountDown((prevTime) => prevTime - 1);
      }, 1000);
    } else if (countDown === 0 && !isTimerEnded) {
      setIsTimerEnded(true);
      if (onTimeEnd) onTimeEnd();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countDown, isTimerEnded, isPaused, onTimeEnd]);

  const resetTimer = (newTime = initialTime) => {
    setCountDown(newTime);
    setIsTimerEnded(false);
    setIsPaused(false);
  };

  const pauseTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsPaused(false);
  };

  return {
    countDown,
    isTimerEnded,
    isPaused,
    resetTimer,
    pauseTimer,
    resumeTimer,
  };
};
