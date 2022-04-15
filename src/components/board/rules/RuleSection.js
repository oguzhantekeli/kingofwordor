import React, { useEffect, useState } from "react";
import { getRules } from "../../../actions/rules";

const RuleSection = ({ answers, setRulesData }) => {
  const [condition, setCondition] = useState("starts with");
  const [letter, setLetter] = useState("a");
  useEffect(() => {
    const rules = getRules();
    setRulesData(rules);
    setCondition(rules.condition);
    setLetter(rules.letter);
  }, [answers]);

  return (
    <>
      <div className="rule">
        Hit them with the word <span className="condition">{condition}</span>{" "}
        <span className="letter">" {letter} "</span>
      </div>
    </>
  );
};

export default RuleSection;
