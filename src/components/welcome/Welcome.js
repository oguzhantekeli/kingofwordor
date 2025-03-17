import React, { useState, useRef, useContext } from 'react';
import useSound from 'use-sound';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import './welcome.css';
import chargeSound from '../../assets/charge.wav';

const Welcome = () => {
  const { setGameStatus, setGameType, soundEnabled } =
    useContext(GlobalStateContext);
  const [isStarted, setIsStarted] = useState(false);
  const [playChargeSound] = useSound(chargeSound, { volume: 0.25 });
  const gameTypeButtons = useRef(null);
  const startButton = useRef(null);

  const onClick = (val) => {
    setGameType(val);
    if (soundEnabled) {
      playChargeSound();
    }
    setGameStatus('ingame');
  };

  return (
    <div className="welcome">
      <h2>Welcome to The Battle</h2>
      {isStarted ? (
        <div className="button-options" ref={gameTypeButtons}>
          <h3>Choose Your Zone</h3>
          <div className="options">
            <div className="option">
              <label>standard 1 minute Challenge</label>
              <button
                type="button"
                gametype="standard"
                onClick={(e) => onClick(e.target.getAttribute('gametype'))}
              >
                Battle..!
              </button>
            </div>
            <div className="option">
              <label>Longest Word Challenge</label>
              <button
                type="button"
                gametype="longest"
                onClick={(e) => onClick(e.target.getAttribute('gametype'))}
              >
                Battle..!
              </button>
            </div>
            <div className="option">
              <label>No mistake Challenge</label>
              <button
                type="button"
                gametype="nomistake"
                onClick={(e) => onClick(e.target.getAttribute('gametype'))}
              >
                Battle..!
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="start-button"
          onClick={() => setIsStarted(true)}
          ref={startButton}
        >
          Start
        </button>
      )}
    </div>
  );
};

export default Welcome;
