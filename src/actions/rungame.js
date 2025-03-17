import { GAME_TYPES, RULES } from '../constants';

const calculateScoreStandard = () => {
  return 1;
};

const calculateScoreLongest = (answerLength) => {
  return answerLength;
};

const calculateScoreNoMistake = (answerLength) => {
  return answerLength;
};

export const rungame = (gametype, answerLength) => {
  switch (gametype) {
    case GAME_TYPES.STANDARD:
      try {
        return calculateScoreStandard();
      } catch (error) {
        return error;
      }
    case GAME_TYPES.LONGEST:
      try {
        return calculateScoreLongest(answerLength);
      } catch (error) {
        return error;
      }
    case GAME_TYPES.NOMISTAKE:
      try {
        return calculateScoreNoMistake(answerLength);
      } catch (error) {
        return error;
      }
    default:
      break;
  }
};

export const doesAnswerMatchRules = (answer, { condition, letter }) => {
  // Using constants for conditions from RULES.CONDITIONS array
  switch (condition) {
    case RULES.CONDITIONS[0]: // "starts with"
      return answer.startsWith(letter);
    case RULES.CONDITIONS[1]: // "ends with"
      return answer.endsWith(letter);
    case RULES.CONDITIONS[2]: // "includes"
      return answer.includes(letter);
    default:
      return false;
  }
};
