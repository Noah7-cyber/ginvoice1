import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider } from './components/ToastProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);

// PWA Service Worker Registration - IMPROVED FOR STORE DETECTION
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      const key = 'ginvoice_last_forced_reload_at';
      const now = Date.now();
      const lastReloadAt = Number(localStorage.getItem(key) || '0');
      if (now - lastReloadAt < 60_000) return;

      localStorage.setItem(key, String(now));
      window.dispatchEvent(new Event('app:update-ready'));
      window.setTimeout(() => window.location.reload(), 700);
    }
  });

  // We register immediately (no 'load' event wait) to satisfy PWABuilder scanners
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('SW registered: ', registration);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New content available; auto-reloading via controllerchange...');
            // Do not call reload() here anymore! The controllerchange listener will handle it.
          } else if (installingWorker.state === 'installed' && !navigator.serviceWorker.controller) {
            console.log('Content is cached for offline use.');
          }
        };
      };
    })
    .catch((error) => console.error('SW registration failed: ', error));
}
