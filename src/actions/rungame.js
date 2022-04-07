const calculateScoreStandart = () => {
  console.log("stdt");
  return Number(546);
};
const calculateScoreLongest = () => {
  console.log("lngst");
  return Number(546);
};
const calculateScoreNoMistake = () => {
  console.log("nomis");
  return Number(546);
};

export const rungame = (gametype) => {
  switch (gametype) {
    case "standart":
      calculateScoreStandart();
      break;
    case "longest":
      calculateScoreLongest();
      break;
    case "nomistake":
      calculateScoreNoMistake();
      break;

    default:
      break;
  }
};
