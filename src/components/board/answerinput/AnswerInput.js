import React, { useState, useContext } from 'react';
import './AnswerInput.css';
import { doesAnswerMatchRules } from '../../../actions/rungame';
import { GlobalStateContext } from '../../../context/GlobalStateContext';
import { useAnswerValidation } from '../../../hooks/useAnswerValidation';
import { useSoundEffects } from '../../../hooks/useSoundEffects';

/**
 * Input component for user to submit word answers
 *
 * @param {Object} props Component properties
 * @param {string} props.gameType Type of game being played
 * @param {Array} props.points Current points array
 * @param {Function} props.setPoints Function to update points
 * @param {number} props.multiplier Score multiplier
 * @param {Function} props.setMultiplier Function to update multiplier
 * @param {Array} props.answers List of previous answers
 * @param {Function} props.setAnswers Function to update answers list
 * @param {Object} props.rulesData Rules for the current game
 */
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
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isFirst, setIsFirst] = useState(true);

  const { state } = useContext(GlobalStateContext);
  const { soundEnabled } = state;

  const { validateAnswer } = useAnswerValidation(gameType);
  const sounds = useSoundEffects(soundEnabled);

  const handleInputChange = (e) => {
    // Allow only letters
    const value = e.target.value.replace(/[^a-zA-Z]/g, '');
    setAnswer(value);

    // Play sword sound on typing
    if (value.length > 0) {
      sounds.playHitSound();
    }

    // Clear any feedback when typing
    if (feedback) {
      setFeedback(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length < 2) return;

    // Check if answer matches rules (target letter, etc)
    const matchesRules = doesAnswerMatchRules(trimmedAnswer, rulesData);
    let currentPoints = 0;

    if (!matchesRules) {
      // Answer doesn't match basic rules
      setAnswer('');
      setPoints([...points, 0]);
      setMultiplier(1);
      sounds.playWrongSound();
      setFeedback({ type: 'error', message: 'Word does not match rules' });

      logAnswer(trimmedAnswer, false, 0);
    } else {
      // Answer matches basic rules, check dictionary
      setAnswer('');
      const result = await validateAnswer(trimmedAnswer);

      if (result.valid) {
        // Valid dictionary word
        if (gameType === 'nomistake' && !isFirst) {
          // Increase multiplier for consecutive correct answers in nomistake mode
          setMultiplier(multiplier * 1.1);
        }

        currentPoints = calculatePoints(trimmedAnswer.length, multiplier);
        setPoints([...points, currentPoints]);
        sounds.playCorrectSound();
        setFeedback({
          type: 'success',
          message: `+${currentPoints.toFixed(2)} points!`,
        });
        setIsFirst(false);

        logAnswer(trimmedAnswer, true, currentPoints);
      } else {
        // Not in dictionary
        setPoints([...points, 0]);
        setMultiplier(1);
        sounds.playWrongSound();
        setFeedback({
          type: 'error',
          message: result.reason || 'Not a valid word',
        });
        setIsFirst(true);

        logAnswer(trimmedAnswer, false, 0);
      }
    }

    // Clear feedback after delay
    setTimeout(() => setFeedback(null), 2000);
  };

  /**
   * Calculate points based on game type and word length
   */
  const calculatePoints = (wordLength, currentMultiplier) => {
    // Use game type to determine scoring
    switch (gameType) {
      case 'longest':
        return wordLength * 2 * currentMultiplier; // Double points for longest mode
      case 'nomistake':
        return wordLength * currentMultiplier;
      default: // standard
        return wordLength * currentMultiplier;
    }
  };

  /**
   * Log answer to the answers list
   */
  const logAnswer = (text, isValid, score) => {
    setAnswers([
      ...answers,
      {
        answerText: text,
        status: isValid.toString().toUpperCase(),
        points: score.toFixed(2),
      },
    ]);
  };

  return (
    <div className="answerinput">
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          type="text"
          name="answer"
          value={answer}
          onChange={handleInputChange}
          minLength="2"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Enter word"
        />

        {feedback && (
          <div className={`feedback ${feedback.type}`}>{feedback.message}</div>
        )}
      </form>
    </div>
  );
};

export default AnswerInput;
