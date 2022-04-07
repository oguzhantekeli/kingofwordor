import React, { useEffect, useState } from "react";

const BoardTop = () => {
  const timer = 3;
  const [countDown, setCountDown] = useState(timer);
  const [isTimerEnded, setIsTimerEnded] = useState(false);
  useEffect(() => {
    let intervale = setInterval(() => {
      if (countDown !== 0) {
        setCountDown(countDown - 1);
      } else {
        clearInterval(intervale);
        setIsTimerEnded(true);
      }
    }, 1000);
    return () => {
      clearInterval(intervale);
    };
  }, [countDown]);

  return (
    <>
      <div className="board-top">
        <div className="start-counter">
          {isTimerEnded ? "Hoooraaaa.." : `${countDown}..`}
        </div>
        {isTimerEnded ? (
          <div className="started-message">---SMASH THEM---</div>
        ) : null}
      </div>
    </>
  );
};

export default BoardTop;
