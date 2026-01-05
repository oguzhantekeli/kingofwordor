import React, { useEffect, useState } from 'react';

const BoardTop = ({ setShowGame }) => {
  const timer = 3;
  const [countDown, setCountDown] = useState(timer);
  const [isTimerEnded, setIsTimerEnded] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCountDown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(intervalId);
          setIsTimerEnded(true);
          setShowGame(true);
          return 0;
        }
        setAnimKey((k) => k + 1);
        return prevCount - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [setShowGame]);

  return (
    <div className="board-top countdown-screen">
      {!isTimerEnded && (
        <div key={animKey} className="countdown-number">
          {countDown}
        </div>
      )}
    </div>
  );
};

export default BoardTop;
