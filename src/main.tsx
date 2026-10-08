import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { startAnalytics } from './analytics';

startAnalytics();
// The dirham sign comes from a font that covers one character; asking for it up front avoids an empty box before the browser decides it is needed.
try { void document.fonts?.load('1em "Dirham-Sans"', '\u20C3'); void document.fonts?.load('1em "Dirham"', '\u20C3'); } catch { /* falls back to the browser's own font */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
