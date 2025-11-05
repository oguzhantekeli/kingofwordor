import React, { useState, useRef, useContext } from 'react';
import useSound from 'use-sound';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import './welcome.css';
import chargeSound from '../../assets/charge.wav';

const Welcome = () => {
  const { setGameStatus, setGameType, soundEnabled } =
    useContext(GlobalStateContext);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState('standard');
  const [playChargeSound] = useSound(chargeSound, { volume: 0.25 });
  const gameTypeButtons = useRef(null);
  const startButton = useRef(null);

  const handleCardSelect = (type) => {
    setSelectedGameType(type);
  };

  const handleStartGame = () => {
    setGameType(selectedGameType);
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
            <div
              className={`option ${selectedGameType === 'standard' ? 'selected' : ''}`}
              onClick={() => handleCardSelect('standard')}
            >
              <h4>Standard Challenge</h4>
              <p>
                Race against time! Submit as many valid words as you can in 60
                seconds.
              </p>
            </div>
            <div
              className={`option ${selectedGameType === 'longest' ? 'selected' : ''}`}
              onClick={() => handleCardSelect('longest')}
            >
              <h4>Longest Word Challenge</h4>
              <p>Go big or go home! Earn double points based on word length.</p>
            </div>
            <div
              className={`option ${selectedGameType === 'nomistake' ? 'selected' : ''}`}
              onClick={() => handleCardSelect('nomistake')}
            >
              <h4>No Mistake Challenge</h4>
              <p>
                Perfect precision! Build your multiplier with consecutive
                correct answers.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="start-game-button"
            onClick={handleStartGame}
          >
            Enter the Battle
          </button>
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
