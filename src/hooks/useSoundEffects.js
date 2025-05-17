import { useEffect, useState } from 'react';

/**
 * Custom hook for managing game sounds
 *
 * @param {boolean} soundEnabled - Whether sound is enabled in game settings
 * @returns {Object} Object containing sound playing functions
 */
export const useSoundEffects = (soundEnabled = true) => {
  // Load sounds dynamically to prevent issues with imports
  const [sounds, setSounds] = useState({
    sword: null,
    correct: null,
    wrong: null,
    timeWarning: null,
  });

  useEffect(() => {
    // Only load sounds if enabled to save resources
    if (soundEnabled) {
      const loadSounds = async () => {
        // Use dynamic imports to load sounds
        const swordSound = new Audio(require('../assets/sword.flac').default);
        const correctSound = new Audio(require('../assets/yay.wav').default);
        const wrongSound = new Audio(require('../assets/pain.wav').default);
        const timeWarningSound = new Audio(
          require('../assets/charge.wav').default
        );

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
      };

      loadSounds().catch(console.error);
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
