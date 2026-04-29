import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix viewport height on Motorola / WebView quirks where 100vh is wrong.
// Sets a CSS variable --app-h to the real innerHeight and keeps it updated.
function syncAppHeight() {
  const h = window.innerHeight;
  document.documentElement.style.setProperty('--app-h', h + 'px');
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
// Also listen to visualViewport for soft-keyboard changes
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncAppHeight);
}

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
