import React, { useState } from 'react';
import AnswerInput from './answerinput/AnswerInput';
import AnswersList from './answerslist/AnswersList';

import RuleSection from './rules/RuleSection';

const GameSection = ({
  gameType,
  points,
  setPoints,
  multiplier,
  setMultiplier,
}) => {
  const [answers, setAnswers] = useState([]);
  const [rulesData, setRulesData] = useState({});

  return (
    <div className="game-content">
      <div className="game-main">
        <div className="game-area">
          <RuleSection answers={answers} setRulesData={setRulesData} />
          <AnswerInput
            setAnswers={setAnswers}
            answers={answers}
            gameType={gameType}
            points={points}
            setPoints={setPoints}
            multiplier={multiplier}
            setMultiplier={setMultiplier}
            rulesData={rulesData}
          />
        </div>
      </div>
      <div className="game-sidebar">
        <AnswersList answers={answers} />
      </div>
    </div>
  );
};

export default GameSection;
