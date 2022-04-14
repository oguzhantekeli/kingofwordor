const calculateScorestandard = (pts) => {
  console.log("stdt");
  return pts * 1.1;
};
const calculateScoreLongest = (pts) => {
  console.log("lngst");
  return pts * 1.1;
};
const calculateScoreNoMistake = (pts) => {
  console.log("nomis");
  return pts * 1.1;
};

export const rungame = (gametype, points) => {
  switch (gametype) {
    case "standard":
      try {
        return calculateScorestandard(points);
      } catch (error) {
        return error;
      }
    case "longest":
      try {
        return calculateScoreLongest(points);
      } catch (error) {
        return error;
      }
    case "nomistake":
      try {
        return calculateScoreNoMistake(points);
      } catch (error) {
        return error;
      }
    default:
      break;
  }
};
