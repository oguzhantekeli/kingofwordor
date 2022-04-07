import React, { useEffect, useState } from "react";
import useSound from "use-sound";
import { rungame } from "../../actions/rungame";
import painSound from "../../assets/pain.wav";
import swordSound from "../../assets/sword.flac";
import sword2Sound from "../../assets/sword2.wav";

const GameSection = ({ gameType, score, setScore }) => {
  const [isCorrect, setIsCorrect] = useState(false);

  const [playSwordSound] = useSound(swordSound, { volume: 0.25 });
  const [playSword2Sound] = useSound(sword2Sound, { volume: 0.25 });
  const [playPainSound] = useSound(painSound, { volume: 0.25 });

  const hitSound = () => {
    const arr = [playSwordSound, playSword2Sound];
    let idx = Math.floor(Math.random() * 2);
    return arr[idx]();
  };
  useEffect(() => {
    console.log("setscore:", score);
    setScore(rungame(gameType));
  }, []);
  console.log("innerscore", score);
  return (
    <>
      <div className="game-section">
        <div className="rule">
          A Word{" "}
          <span className="condition">[startsWith,endsWith,includes]</span>{" "}
          letter <span className="letter">[a,b,c,...,y,z]</span>
        </div>
        <div className="answerinput">
          <label htmlFor="answer">Hit 'em Hard...</label>
          <input
            autoFocus
            type="text"
            name="answer"
            onKeyDown={() => hitSound()}
          />
        </div>
      </div>
    </>
  );
};

export default GameSection;
