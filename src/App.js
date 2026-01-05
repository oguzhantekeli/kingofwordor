import React from 'react';
import { GlobalStateProvider } from './context/GlobalStateContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import MainApp from './MainApp';
import './mainstyles/main.css';

const App = () => {
  return (
    <ErrorBoundary>
      <GlobalStateProvider>
        <MainApp />
      </GlobalStateProvider>
    </ErrorBoundary>
  );
};

export default App;
