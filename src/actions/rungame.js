const calculateScorestandard = () => {
  return 1;
};
const calculateScoreLongest = (answerLength) => {
  return answerLength;
};
const calculateScoreNoMistake = (answerLength) => {
  return answerLength * 1.1;
};

export const rungame = (gametype, answerLength) => {
  switch (gametype) {
    case "standard":
      try {
        return calculateScorestandard();
      } catch (error) {
        return error;
      }
    case "longest":
      try {
        return calculateScoreLongest(answerLength);
      } catch (error) {
        return error;
      }
    case "nomistake":
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
  let res;
  switch (condition) {
    case "starts with":
      res = answer.startsWith(letter) ? true : false;
      break;
    case "ends with":
      res = answer.endsWith(letter) ? true : false;
      break;
    case "includes":
      res = answer.includes(letter) ? true : false;
      break;
    default:
      res = false;
      break;
  }
  return res;
};
