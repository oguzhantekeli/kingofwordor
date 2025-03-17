import React from 'react';

const AnswersList = ({ answers }) => {
  return (
    <>
      <div className="answers-list">
        <h3>Answers</h3>
        <table>
          <thead />
          <tbody>
            {answers.map((item, idx) => {
              return (
                <tr className="answer-item" key={idx}>
                  <td className="answertext">{item.answerText}</td>
                  <td className={item.status.toLowerCase()}>{item.status}</td>
                  <td className="pointsvalue">{item.points}</td>
                  <td>points.</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default AnswersList;
