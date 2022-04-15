const conditions = ["starts with", "ends with", "includes"];

const letters = "abcdefghijklmnopqrstuvwxyz";

const possibleStarts = {
  a: "53000",
  b: "44000",
  c: "67000",
  d: "43000",
  e: "31000",
  f: "27000",
  g: "26000",
  h: "34000",
  i: "25000",
  j: "6300",
  k: "13000",
  l: "23000",
  m: "53000",
  n: "29000",
  o: "23000",
  p: "70000",
  q: "4300",
  r: "36000",
  s: "79000",
  t: "40000",
  u: "25000",
  v: "12000",
  w: "15000",
  x: "1900",
  y: "3500",
  z: "4200",
};

const possibleEnds = {
  a: "26000",
  b: "1900",
  c: "24000",
  d: "61000",
  e: "98000",
  f: "2000",
  g: "40000",
  h: "12000",
  i: "8500",
  j: "210",
  k: "7300",
  l: "32000",
  m: "16000",
  n: "53000",
  o: "7400",
  p: "4700",
  q: "230",
  r: "35000",
  s: "260000",
  t: "34000",
  u: "2000",
  v: "680",
  w: "1900",
  x: "2200",
  y: "51000",
  z: "1100",
};

export const getRules = () => {
  const condition = conditions[Math.floor(Math.random() * 3)];
  const letter = letters[Math.floor(Math.random() * letters.length)];
  let wordCount = "8762381276 :)";
  if (condition === "starts with") {
    wordCount = possibleStarts[letter];
  }
  if (condition === "ends with") {
    wordCount = possibleEnds[letter];
  }
  return { condition: condition, letter: letter, wordCount: wordCount };
};
