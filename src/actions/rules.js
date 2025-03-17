import { RULES } from '../constants';

export const getRules = () => {
  const { CONDITIONS, LETTERS, POSSIBLE_STARTS, POSSIBLE_ENDS } = RULES;
  const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  let wordCount = '8762381276 :)';
  if (condition === 'starts with') {
    wordCount = POSSIBLE_STARTS[letter];
  }
  if (condition === 'ends with') {
    wordCount = POSSIBLE_ENDS[letter];
  }
  return { condition, letter, wordCount };
};
