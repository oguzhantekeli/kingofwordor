import React, { memo } from 'react';

/**
 * Displays the list of submitted answers
 * Memoized to prevent re-renders when parent state changes
 */
const AnswersList = memo(({ answers }) => {
  return (
    <>
      <div className="answers-list">
        <h3>Your Words ({answers.length})</h3>
        <table>
          <thead />
          <tbody>
            {answers.map((item) => {
              return (
                <tr className="answer-item" key={item.id}>
                  <td className="answertext">{item.answerText}</td>
                  <td className={item.status.toLowerCase()}>{item.status}</td>
                  <td className="pointsvalue">{item.points}</td>
                  <td>pts</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
});

AnswersList.displayName = 'AnswersList';

export default AnswersList;
