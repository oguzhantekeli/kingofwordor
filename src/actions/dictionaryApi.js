import { DICTIONARY_API_BASE_URL } from '../constants';

/**
 * Checks if a word exists in the dictionary
 *
 * @param {string} answer - The word to check
 * @returns {Object} Result object with validation details
 */
export const checkAnswer = async (answer) => {
  try {
    const response = await fetch(`${DICTIONARY_API_BASE_URL}/${answer}`);

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, reason: 'Word not found in dictionary' };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Clear console for production code - remove in future
    if (data.title === 'No Definitions Found') {
      return { valid: false, reason: 'Word not found in dictionary' };
    }

    return { valid: true, word: answer, data };
  } catch (error) {
    console.error('Dictionary API error:', error);
    return {
      valid: false,
      reason: error.message || 'Network or API error',
      error,
    };
  }
};
