import React, { useEffect, useState } from 'react';
import { getRules } from '../../../actions/rules';

const RuleSection = ({ answers, setRulesData }) => {
  const [rules, setRules] = useState({
    condition: 'starts with',
    letter: 'a',
    wordCount: '0',
  });

  useEffect(() => {
    const newRules = getRules();
    setRules(newRules);
    setRulesData(newRules);
  }, [answers, setRulesData]);

  return (
    <>
      <div className="rule">
        Hit them with the word{' '}
        <span className="condition">{rules.condition}</span>{' '}
        <span className="letter">&quot; {rules.letter} &quot;</span>
      </div>
      <p className="countinfo">!!! There are {rules.wordCount} of them...</p>
    </>
  );
};

export default RuleSection;
