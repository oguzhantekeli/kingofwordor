import React, { useState, useContext, lazy, Suspense } from 'react';
import { GlobalStateContext } from './context/GlobalStateContext';
import Header from './components/header/Header';
import Welcome from './components/welcome/Welcome';
import Board from './components/board/Board';
import Toast from './components/toast/Toast';
import { GAME_STATUSES } from './constants';
import './MainApp.css';

// Lazy load less critical components
const EndGame = lazy(() => import('./components/endgame/EndGame'));
const SettingsModal = lazy(() => import('./components/settings/SettingsModal'));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="loading-fallback">Loading...</div>
);

const MainApp = () => {
  const { gameStatus, setGameStatus, totalScore } =
    useContext(GlobalStateContext);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const screenChange = (status) => {
    switch (status) {
      case GAME_STATUSES.WELCOME:
        return <Welcome />;
      case GAME_STATUSES.INGAME:
        return <Board />;
      case GAME_STATUSES.ENDGAME:
        return (
          <Suspense fallback={<LoadingFallback />}>
            <EndGame totalScore={totalScore} setGameStatus={setGameStatus} />
          </Suspense>
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
        <main className="app-content">{screenChange(gameStatus)}</main>
      </div>
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={closeSettings}
          onSave={handleSettingsSave}
        />
      </Suspense>
      <Toast message={toastMessage} />
    </>
  );
};

export default MainApp;
