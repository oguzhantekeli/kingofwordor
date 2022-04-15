export const checkAnswer = async (answer) => {
  let result;
  try {
    result = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${answer}`
    )
      .then((a) => a.json())
      .then((data) => data);
  } catch (error) {
    return error;
  }
  console.clear();
  if (result.title === "No Definitions Found") {
    console.error("No, my friend. That was wrong...");
    return false;
  } else {
    return true;
  }
};
