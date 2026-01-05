import React from 'react';
import { GAME_STATUSES } from '../../constants';

import './endgame.css';

const EndGame = ({ setGameStatus, totalScore }) => {
  const onClick = () => {
    setGameStatus(GAME_STATUSES.WELCOME);
  };

  /**
   * Share score using Web Share API with clipboard fallback
   */
  const handleShare = async () => {
    const shareText = `⚔️ King of Wordor ⚔️\n\nI scored ${totalScore.toFixed(
      2
    )} points!\n\nCan you beat my score?`;

    // Check if Web Share API is available and we're in a secure context
    if (navigator.share && navigator.canShare) {
      try {
        await navigator.share({
          title: 'King of Wordor - My Score',
          text: shareText,
          url: window.location.href,
        });
        return; // Success - don't fall through to clipboard
      } catch (err) {
        // Only fall back to clipboard if it wasn't a user cancel
        if (err.name === 'AbortError') {
          return; // User cancelled, do nothing
        }
        // Share failed, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    copyToClipboard(shareText);
  };

  /**
   * Copy text to clipboard with user feedback
   */
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Score copied to clipboard! Paste it anywhere to share.');
    } catch (err) {
      // Final fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Score copied to clipboard! Paste it anywhere to share.');
    }
  };

  return (
    <>
      <div className="endgame">
        <h2>Well Done, Champion!</h2>
        <h3>The next challenge awaits...</h3>
        <div className="showresult">
          <h3>Score</h3>
          <span className="score-value">{totalScore.toFixed(2)}</span>
        </div>
        <div className="takescreenshot">
          <p>Share your score with your friends</p>
          <div className="resultbuttons">
            <button type="button" onClick={handleShare}>
              Share
            </button>
            <button className="endgame-restart" onClick={onClick}>
              Restart
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EndGame;
