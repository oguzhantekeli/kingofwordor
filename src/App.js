import React from 'react';
import { GlobalStateProvider } from './context/GlobalStateContext';
import MainApp from './MainApp';
import './mainstyles/main.css';

const App = () => {
  return (
    <GlobalStateProvider>
      <MainApp />
    </GlobalStateProvider>
  );
};

export default App;
