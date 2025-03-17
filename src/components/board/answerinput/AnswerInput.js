import React, { useState, useContext } from 'react';
import useSound from 'use-sound';
import painSound from '../../../assets/pain.wav';
import swordSound from '../../../assets/sword.flac';
import sword2Sound from '../../../assets/sword2.wav';
import yaySound from '../../../assets/yay.wav';
import { rungame } from '../../../actions/rungame';
import { checkAnswer } from '../../../actions/dictionaryApi';
import { doesAnswerMatchRules } from '../../../actions/rungame';
import { GlobalStateContext } from '../../../context/GlobalStateContext';

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
  const [answer, setAnswer] = useState('');
  const [isFirst, setIsFirst] = useState(true);

  const { soundEnabled } = useContext(GlobalStateContext);

  const hitSound = () => {
    if (!soundEnabled) return;
    const sounds = [playSwordSound, playSword2Sound];
    const idx = Math.floor(Math.random() * sounds.length);
    sounds[idx]();
  };

  const onChange = (val) => {
    if (soundEnabled) hitSound();
    setAnswer(val);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (answer.length < 2) return;

    const control = doesAnswerMatchRules(answer, rulesData);
    let currentPoints = 0;
    let response;

    if (!control) {
      setAnswer('');
      setPoints([...points, 0]);
      setMultiplier(1);
      if (soundEnabled) playPainSound();
      response = false;
    } else {
      setAnswer('');
      response = await checkAnswer(answer);
      if (response) {
        if (gameType === 'nomistake' && !isFirst) {
          setMultiplier(multiplier * 1.1);
        }
        currentPoints = rungame(gameType, answer.length) * multiplier;
        setPoints([...points, currentPoints]);
        if (soundEnabled) playYaySound();
        setIsFirst(false);
      } else {
        setPoints([...points, 0]);
        setMultiplier(1);
        if (soundEnabled) playPainSound();
        setIsFirst(true);
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
  };

  return (
    <div className="answerinput">
      <form onSubmit={onSubmit}>
        <input
          autoFocus
          type="text"
          name="answer"
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          minLength="2"
          autoComplete="off"
          autoCorrect="off"
        />
      </form>
    </div>
  );
};

export default AnswerInput;
