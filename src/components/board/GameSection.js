import React, { useContext } from 'react';
import AnswerInput from './answerinput/AnswerInput';
import AnswersList from './answerslist/AnswersList';
import RuleSection from './rules/RuleSection';
import { GlobalStateContext } from '../../context/GlobalStateContext';

const GameSection = () => {
  const { state } = useContext(GlobalStateContext);
  const { answers } = state;

  return (
    <div className="game-content">
      <div className="game-main">
        <div className="game-area">
          <RuleSection />
          <AnswerInput />
        </div>
      </div>
      <div className="game-sidebar">
        <AnswersList answers={answers} />
      </div>
    </div>
  );
};

export default GameSection;
