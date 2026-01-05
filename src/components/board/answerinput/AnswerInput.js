import React, {
  useState,
  useContext,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import './AnswerInput.css';
import { doesAnswerMatchRules } from '../../../actions/rungame';
import { GlobalStateContext } from '../../../context/GlobalStateContext';
import { useAnswerValidation } from '../../../hooks/useAnswerValidation';
import { useSoundEffects } from '../../../hooks/useSoundEffects';
import Keyboard from '../../keyboard/Keyboard';

/**
 * Input component for user to submit word answers
 * Now uses GlobalStateContext instead of props for game state
 * Includes custom on-screen keyboard for mobile
 */
const AnswerInput = () => {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isFirst, setIsFirst] = useState(true);
  // Initialize mobile detection immediately to prevent keyboard flash
  const [isMobile, setIsMobile] = useState(() => {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
  });
  const inputRef = useRef(null);

  // Get all game state from context
  const { state, addAnswer, addPoints, setMultiplier } =
    useContext(GlobalStateContext);
  const { gameType, multiplier, rulesData, soundEnabled, answers } = state;

  const { validateAnswer } = useAnswerValidation(gameType);
  const sounds = useSoundEffects(soundEnabled);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keep input focused on mobile
  useEffect(() => {
    if (isMobile && inputRef.current) {
      const keepFocus = () => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      };
      // Focus on mount and when clicking anywhere
      keepFocus();
      document.addEventListener('click', keepFocus);
      return () => document.removeEventListener('click', keepFocus);
    }
  }, [isMobile]);

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

  // Handle keyboard key press (letter keys)
  const handleKeyPress = useCallback(
    (key) => {
      setAnswer((prev) => prev + key.toLowerCase());
      sounds.playHitSound();

      // Clear any feedback when typing
      if (feedback) {
        setFeedback(null);
      }
    },
    [feedback, sounds]
  );

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setAnswer((prev) => prev.slice(0, -1));
    if (feedback) {
      setFeedback(null);
    }
  }, [feedback]);

  // Handle clear all
  const handleClear = useCallback(() => {
    setAnswer('');
    if (feedback) {
      setFeedback(null);
    }
  }, [feedback]);

  // Handle enter/submit
  const handleEnter = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.form.requestSubmit();
    }
  }, []);

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
      addPoints(0);
      setMultiplier(1);
      sounds.playWrongSound();
      setFeedback({ type: 'error', message: '✗' });

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
        addPoints(currentPoints);
        sounds.playCorrectSound();
        setFeedback({
          type: 'success',
          message: '✓',
        });
        setIsFirst(false);

        logAnswer(trimmedAnswer, true, currentPoints);
      } else {
        // Not in dictionary
        addPoints(0);
        setMultiplier(1);
        sounds.playWrongSound();
        setFeedback({
          type: 'error',
          message: '✗',
        });
        setIsFirst(true);

        logAnswer(trimmedAnswer, false, 0);
      }
    }

    // Clear feedback after delay
    setTimeout(() => setFeedback(null), 1000);
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
   * Log answer to the answers list via context
   */
  const logAnswer = (text, isValid, score) => {
    addAnswer({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      answerText: text,
      status: isValid.toString().toUpperCase(),
      points: score.toFixed(2),
    });
  };

  return (
    <div className="answerinput">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          name="answer"
          value={answer}
          onChange={handleInputChange}
          minLength="2"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          inputMode={isMobile ? 'none' : 'text'}
          readOnly={isMobile}
          aria-label="Enter word"
          placeholder="Type your word..."
          className={feedback?.type === 'error' ? 'error' : ''}
        />

        {feedback && (
          <div className={`feedback ${feedback.type}`}>{feedback.message}</div>
        )}
      </form>

      {/* Words list */}
      <div className="words-list">
        {answers &&
          answers.map((item) => (
            <span
              key={item.id}
              className={`word-item ${item.status.toLowerCase()}`}
            >
              {item.answerText}
            </span>
          ))}
      </div>

      {/* Custom keyboard for mobile */}
      {isMobile && (
        <Keyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onEnter={handleEnter}
          onClear={handleClear}
        />
      )}

      {/* Desktop hint */}
      {!isMobile && (
        <div className="input-hint">Press Enter to submit your answer</div>
      )}
    </div>
  );
};

export default AnswerInput;
