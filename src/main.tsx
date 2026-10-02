import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './ui/theme/fonts.css';
import './ui/theme/tokens.css';
import './ui/theme/base.css';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';

const host = document.getElementById('root');
if (!host) throw new Error('#root missing from index.html');

createRoot(host).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
