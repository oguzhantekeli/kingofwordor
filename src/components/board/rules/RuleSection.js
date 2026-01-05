import React, { useEffect, useState, useContext, useRef } from 'react';
import { getRules } from '../../../actions/rules';
import { GlobalStateContext } from '../../../context/GlobalStateContext';

/**
 * Displays the current word rule (condition + letter)
 * Rules change after each answer submission (by design)
 */
const RuleSection = () => {
  const { state, setRulesData } = useContext(GlobalStateContext);
  const { answers } = state;
  const [rules, setRules] = useState({
    condition: 'starts with',
    letter: 'a',
    wordCount: '0',
  });
  // Track answers length to detect actual answer submissions
  const prevAnswersLengthRef = useRef(0);

  // Generate rules on mount and when a new answer is added
  useEffect(() => {
    const currentLength = answers.length;
    // Only regenerate rules if answers array actually grew (new answer added)
    // or on initial mount (both are 0)
    if (currentLength !== prevAnswersLengthRef.current || currentLength === 0) {
      const newRules = getRules();
      setRules(newRules);
      setRulesData(newRules);
      prevAnswersLengthRef.current = currentLength;
    }
  }, [answers.length, setRulesData]);

  return (
    <div
      className="game-area"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="rule-intro">Hit them with the word</p>
      <div className="rule-main">
        <span className="condition">{rules.condition}</span>
        <span className="letter">&quot;{rules.letter.toUpperCase()}&quot;</span>
      </div>
      <p className="countinfo">
        {parseInt(rules.wordCount).toLocaleString()} possible words
      </p>
    </div>
  );
};

export default RuleSection;
