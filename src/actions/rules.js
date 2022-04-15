const conditions = ["starts with", "ends with", "includes"];

const letters = "abcdefghijklmnopqrstuvwxyz";

export const getRules = () => {
  let idxCondition = Math.floor(Math.random() * 3);
  let idxLetters = Math.floor(Math.random() * letters.length);
  return { condition: conditions[idxCondition], letter: letters[idxLetters] };
};
