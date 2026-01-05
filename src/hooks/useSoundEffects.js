import { useEffect, useState } from 'react';

// ES6 static imports for sound assets (CRA compatible)
import swordSrc from '../assets/sword.flac';
import correctSrc from '../assets/yay.wav';
import wrongSrc from '../assets/pain.wav';
import timeWarningSrc from '../assets/charge.wav';

/**
 * Custom hook for managing game sounds
 *
 * @param {boolean} soundEnabled - Whether sound is enabled in game settings
 * @returns {Object} Object containing sound playing functions
 */
export const useSoundEffects = (soundEnabled = true) => {
  const [sounds, setSounds] = useState({
    sword: null,
    correct: null,
    wrong: null,
    timeWarning: null,
  });

  useEffect(() => {
    // Only load sounds if enabled to save resources
    if (soundEnabled) {
      const swordSound = new Audio(swordSrc);
      const correctSound = new Audio(correctSrc);
      const wrongSound = new Audio(wrongSrc);
      const timeWarningSound = new Audio(timeWarningSrc);

      // Set volume for all sounds
      [swordSound, correctSound, wrongSound, timeWarningSound].forEach(
        (sound) => {
          sound.volume = 0.25;
        }
      );

      setSounds({
        sword: swordSound,
        correct: correctSound,
        wrong: wrongSound,
        timeWarning: timeWarningSound,
      });
    }
  }, [soundEnabled]);

  const playSound = (soundName) => {
    if (!soundEnabled || !sounds[soundName]) return;

    // Reset sound to beginning if it's already playing
    sounds[soundName].pause();
    sounds[soundName].currentTime = 0;
    sounds[soundName]
      .play()
      .catch((err) => console.error(`Error playing ${soundName} sound:`, err));
  };

  return {
    playHitSound: () => playSound('sword'),
    playCorrectSound: () => playSound('correct'),
    playWrongSound: () => playSound('wrong'),
    playTimeWarning: () => playSound('timeWarning'),
  };
};
