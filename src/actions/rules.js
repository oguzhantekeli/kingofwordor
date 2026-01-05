import { RULES } from '../constants';

export const getRules = () => {
  const {
    CONDITIONS,
    LETTERS,
    POSSIBLE_STARTS,
    POSSIBLE_ENDS,
    POSSIBLE_INCLUDES,
  } = RULES;
  const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  let wordCount = '0';

  if (condition === 'starts with') {
    wordCount = POSSIBLE_STARTS[letter];
  } else if (condition === 'ends with') {
    wordCount = POSSIBLE_ENDS[letter];
  } else if (condition === 'includes') {
    wordCount = POSSIBLE_INCLUDES[letter];
  }

  return { condition, letter, wordCount };
};
