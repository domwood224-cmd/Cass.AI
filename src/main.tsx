import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Global error handler for uncaught errors in WebView
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', message, source, lineno, colno, error);
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
