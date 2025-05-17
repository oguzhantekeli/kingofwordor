import { useContext } from 'react';
import { checkAnswer } from '../actions/dictionaryApi';
import { GlobalStateContext } from '../context/GlobalStateContext';

/**
 * Custom hook for validating answers and updating score
 *
 * @param {string} gameType - Type of game being played
 * @returns {Object} Object containing validation and score update functions
 */
export const useAnswerValidation = (gameType) => {
  const { state, dispatch } = useContext(GlobalStateContext);
  const { rulesData, points, multiplier } = state;

  const validateAnswer = async (answer) => {
    if (!answer) return { valid: false, reason: 'empty' };

    // Check minimum word length
    if (answer.length < rulesData.minLength) {
      return { valid: false, reason: 'tooShort' };
    }

    // Check if answer contains the target letter
    if (
      gameType === 'targetLetter' &&
      !answer.toLowerCase().includes(rulesData.targetLetter.toLowerCase())
    ) {
      return { valid: false, reason: 'noTargetLetter' };
    }

    // Dictionary validation
    try {
      const result = await checkAnswer(answer);
      return {
        valid: result.valid,
        reason: result.valid ? 'valid' : 'notInDictionary',
        word: answer,
      };
    } catch (error) {
      return { valid: false, reason: 'apiError', error: error.message };
    }
  };

  const calculateScore = (word) => {
    // Basic scoring - word length × multiplier
    const baseScore = word.length * multiplier;
    return baseScore;
  };

  const updateScore = (word) => {
    const score = calculateScore(word);
    dispatch({
      type: 'UPDATE_SCORE',
      payload: {
        points: points + score,
        lastWordScore: score,
        lastWord: word,
      },
    });
    return score;
  };

  return { validateAnswer, updateScore };
};
