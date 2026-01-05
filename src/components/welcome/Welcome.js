import React, { useState, useRef, useContext, useCallback } from 'react';
import useSound from 'use-sound';
import { GlobalStateContext } from '../../context/GlobalStateContext';
import { GAME_STATUSES, GAME_TYPES } from '../../constants';
import GameModeCarousel from '../carousel/GameModeCarousel';
import './welcome.css';
import chargeSound from '../../assets/charge.wav';

// Game mode options for carousel
const GAME_MODE_OPTIONS = [
  {
    type: GAME_TYPES.STANDARD,
    title: 'Standard Challenge',
    description: 'Race against time! Submit as many valid words as you can.',
  },
  {
    type: GAME_TYPES.LONGEST,
    title: 'Longest Word',
    description: 'Go big or go home! Earn double points for longer words.',
  },
  {
    type: GAME_TYPES.NOMISTAKE,
    title: 'No Mistake',
    description: 'Perfect precision! Build multiplier with correct answers.',
  },
];

const Welcome = () => {
  const { setGameStatus, setGameType, soundEnabled } =
    useContext(GlobalStateContext);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);
  const [playChargeSound] = useSound(chargeSound, { volume: 0.25 });
  const gameTypeButtons = useRef(null);
  const startButton = useRef(null);

  const handleModeSelect = useCallback((index) => {
    setSelectedModeIndex(index);
  }, []);

  const handleCardSelect = (type) => {
    const index = GAME_MODE_OPTIONS.findIndex((opt) => opt.type === type);
    if (index !== -1) {
      setSelectedModeIndex(index);
    }
  };

  const handleStartGame = () => {
    setGameType(GAME_MODE_OPTIONS[selectedModeIndex].type);
    if (soundEnabled) {
      playChargeSound();
    }
    setGameStatus(GAME_STATUSES.INGAME);
  };

  const selectedGameType = GAME_MODE_OPTIONS[selectedModeIndex].type;

  return (
    <div className="welcome">
      {!isStarted && <h2>Welcome to The Battle</h2>}
      {isStarted ? (
        <div className="button-options" ref={gameTypeButtons}>
          <h3 id="game-mode-heading">Choose Your Zone</h3>

          {/* Mobile: Carousel */}
          <div className="mobile-carousel">
            <GameModeCarousel
              options={GAME_MODE_OPTIONS}
              selectedIndex={selectedModeIndex}
              onSelect={handleModeSelect}
            />
          </div>

          {/* Desktop: Grid */}
          <div
            className="options desktop-options"
            role="radiogroup"
            aria-labelledby="game-mode-heading"
          >
            {GAME_MODE_OPTIONS.map((option, index) => (
              <div
                key={option.type}
                className={`option ${selectedGameType === option.type ? 'selected' : ''}`}
                onClick={() => handleCardSelect(option.type)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleCardSelect(option.type)
                }
                role="radio"
                aria-checked={selectedGameType === option.type}
                tabIndex={0}
              >
                <h4>{option.title}</h4>
                <p>{option.description}</p>
              </div>
            ))}
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
