import React, { useEffect, useRef, useState } from "react";
import useSound from "use-sound";
import "./welcome.css";
import chargeSound from "../../assets/charge.wav";
const Welcome = ({ changeStatus, setGameType }) => {
  // const [gameType, setGameType] = useState("standart");
  const [isStarted, setIsStarted] = useState(false);
  const [playChargeSound] = useSound(chargeSound, { volume: 0.25 });
  const onClick = (val) => {
    setGameType(val);
    playChargeSound();
    changeStatus("ingame");
  };
  useEffect(() => {}, [setGameType, isStarted]);
  const gameTypeButtons = useRef(null);
  const startButton = useRef(null);

  return (
    <>
      <div className="welcome">
        <h2>Welcome to The Battle</h2>
        {isStarted ? (
          <>
            <div className="button-options" ref={gameTypeButtons}>
              <h3>Choose Your Zone</h3>
              <div className="options">
                <div className="option">
                  <label>Standart 1 minute Challenge</label>
                  <button
                    type="button"
                    gametype="standart"
                    onClick={(e) => onClick(e.target.getAttribute("gametype"))}
                  >
                    Battle..!
                  </button>
                </div>
                <div className="option">
                  <label>Longest Word Challenge</label>
                  <button
                    type="button"
                    gametype="longest"
                    onClick={(e) => onClick(e.target.getAttribute("gametype"))}
                  >
                    Battle..!
                  </button>
                </div>
                <div className="option">
                  <label>No mistake Challenge</label>
                  <button
                    type="button"
                    gametype="nomistake"
                    onClick={(e) => onClick(e.target.getAttribute("gametype"))}
                  >
                    Battle..!
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="start-button"
              onClick={() => setIsStarted(!isStarted)}
              ref={startButton}
            >
              Start
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default Welcome;
