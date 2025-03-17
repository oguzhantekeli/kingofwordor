import React, { useEffect, useState } from 'react';

const BoardTop = ({ setShowGame }) => {
  const timer = 3;
  const [countDown, setCountDown] = useState(timer);
  const [isTimerEnded, setIsTimerEnded] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCountDown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(intervalId);
          setIsTimerEnded(true);
          setShowGame(true);
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [setShowGame]);

  return (
    <div className="board-top">
      <div className="start-counter">
        {isTimerEnded ? '' : `${countDown}..`}
      </div>
      {isTimerEnded && <div className="started-message">---SMASH THEM---</div>}
    </div>
  );
};

export default BoardTop;
