import React, { useState } from "react";
import useSound from "use-sound";
import painSound from "../../../assets/pain.wav";
import swordSound from "../../../assets/sword.flac";
import sword2Sound from "../../../assets/sword2.wav";
import yaySound from "../../../assets/yay.wav";
import { rungame } from "../../../actions/rungame";
import { checkAnswer } from "../../../actions/dictionaryApi";
import { doesAnswerMatchRules } from "../../../actions/rungame";

const AnswerInput = ({
  gameType,
  points,
  setPoints,
  multiplier,
  setAnswers,
  answers,
  rulesData,
  setMultiplier,
}) => {
  const [playSwordSound] = useSound(swordSound, { volume: 0.25 });
  const [playSword2Sound] = useSound(sword2Sound, { volume: 0.25 });
  const [playPainSound] = useSound(painSound, { volume: 0.25 });
  const [playYaySound] = useSound(yaySound, { volume: 0.25 });

  const [answer, setAnswer] = useState("");
  //   const [answers, setAnswers] = useState([]);

  const onChange = (val) => {
    hitSound();
    setAnswer(val);
  };
  const hitSound = () => {
    const arr = [playSwordSound, playSword2Sound];
    let idx = Math.floor(Math.random() * 2);
    return arr[idx]();
  };

  const onSubmit = async (e) => {
    const control = doesAnswerMatchRules(answer, rulesData);
    let currentPoints = 0;
    let response;
    e.preventDefault();
    if (answer.length >= 2) {
      if (!control) {
        setAnswer("");
        setPoints([...points, 0]);
        setMultiplier(1);
        playPainSound();
        response = false;
      } else {
        setAnswer("");
        response = await checkAnswer(answer);
        if (response) {
          if (gameType === "nomistake") {
            setMultiplier(multiplier * 1.1);
          }
          currentPoints = rungame(gameType, answer.length) * multiplier;
          setPoints([...points, currentPoints]);
          playYaySound();
        } else {
          setPoints([...points, 0]);
          setMultiplier(1);
          playPainSound();
        }
      }
      setAnswers([
        ...answers,
        {
          answerText: answer,
          status: response.toString().toUpperCase(),
          points: currentPoints.toFixed(2),
        },
      ]);
    }
  };
  return (
    <>
      <div className="answerinput">
        <form onSubmit={(e) => onSubmit(e)}>
          <input
            autoFocus
            type="text"
            name="answer"
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            minLength="2"
          />
        </form>
      </div>
    </>
  );
};

export default AnswerInput;
