import React, { useState, useContext } from 'react';
import { GlobalStateContext } from './context/GlobalStateContext';
import Header from './components/header/Header';
import Welcome from './components/welcome/Welcome';
import Board from './components/board/Board';
import EndGame from './components/endgame/EndGame';
import SettingsModal from './components/settings/SettingsModal';
import Toast from './components/toast/Toast';
import { GAME_STATUSES } from './constants';

const MainApp = () => {
  const { gameStatus, setGameStatus, gameType, totalScore, setTotalScore } =
    useContext(GlobalStateContext);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const screenChange = (status) => {
    switch (status) {
      case GAME_STATUSES.WELCOME:
        return <Welcome />;
      case GAME_STATUSES.INGAME:
        return (
          <Board
            setGameStatus={setGameStatus}
            gameType={gameType}
            setTotalScore={setTotalScore}
          />
        );
      case GAME_STATUSES.ENDGAME:
        return (
          <EndGame totalScore={totalScore} setGameStatus={setGameStatus} />
        );
      default:
        return <div>An Error Occurred, please refresh page.</div>;
    }
  };

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  const handleSettingsSave = () => {
    closeSettings();
    showToast('Settings saved successfully!');
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  return (
    <>
      <div className="app">
        <Header onSettingsClick={openSettings} />
        {screenChange(gameStatus)}
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        onSave={handleSettingsSave}
      />
      <Toast message={toastMessage} />
    </>
  );
};

export default MainApp;
