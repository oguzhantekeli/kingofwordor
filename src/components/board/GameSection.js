import React, { useState } from "react";
import useSound from "use-sound";
import { rungame } from "../../actions/rungame";
import painSound from "../../assets/pain.wav";
import swordSound from "../../assets/sword.flac";
import sword2Sound from "../../assets/sword2.wav";

const GameSection = ({ gameType, setPoints, setMultiplier }) => {
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);

  const [playSwordSound] = useSound(swordSound, { volume: 0.25 });
  const [playSword2Sound] = useSound(sword2Sound, { volume: 0.25 });
  const [playPainSound] = useSound(painSound, { volume: 0.25 });

  const onChange = (val) => {
    hitSound();
    setAnswer(val);
  };

  const hitSound = () => {
    const arr = [playSwordSound, playSword2Sound];
    let idx = Math.floor(Math.random() * 2);
    return arr[idx]();
  };
  const onSubmit = (e) => {
    e.preventDefault();
    if (answer.length >= 2) {
      console.log(answer);
    }
  };
  return (
    <>
      <div className="game-section">
        <div className="game-area">
          <div className="rule">
            Hit them with the word <span className="condition">startsWith</span>{" "}
            <span className="letter">" T "</span>
          </div>
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
        </div>
        <div className="answers-list">
          <h3>Answers</h3>
          <table>
            <tr className="answer-item">
              <td className="answertext">Answerlong1</td>
              <td className="true">TRUE</td>
              <td className="pointsvalue">4</td>
              <td>points.</td>
            </tr>
            <tr className="answer-item">
              <td className="answertext">Answer2</td>
              <td className="true">TRUE</td>
              <td className="pointsvalue">5</td>
              <td>points.</td>
            </tr>
            <tr className="answer-item">
              <td className="answertext">Answerthelongest3</td>
              <td className="false">FALSE</td>
              <td className="pointsvalue">0</td>
              <td>points.</td>
            </tr>
            <tr className="answer-item">
              <td className="answertext">Answer4</td>
              <td className="true">TRUE</td>
              <td className="pointsvalue">24</td>
              <td>points.</td>
            </tr>
          </table>
        </div>
      </div>
    </>
  );
};

export default GameSection;
